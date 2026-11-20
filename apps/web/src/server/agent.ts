import "server-only";

import { DEFAULT_MODEL, createGeminiModel, runAgentTurn } from "@nexo/agent";
import type { AgentTurn, HistoryItem } from "@nexo/agent";
import { agentCanReply, err, ok } from "@nexo/domain";
import type { AgentTrace, Result } from "@nexo/domain";
import { eq } from "drizzle-orm";

import type { ChatMessage, ConversationEvent } from "@/lib/chat-types";

import { getConversation, publishAll, toChatMessage } from "./conversations";
import { getDb } from "./db/client";
import { conversations, messages } from "./db/schema";
import { env } from "./env";
import { publish } from "./events";
import { handOffInTx } from "./handoff";
import { createLimiter } from "./rate-limit";
import { tickets } from "./tickets";

const modelName = env.aiModel ?? DEFAULT_MODEL;
const model = env.googleApiKey
  ? createGeminiModel({ apiKey: env.googleApiKey, model: modelName })
  : undefined;

// Custo e abuso: cada turno chama o modelo de 1 a 3 vezes. Os limites valem antes de qualquer chamada.
const MINUTE = 60_000;
const limits = {
  perUser: createLimiter({ max: env.limits.turnsPerUserHour, windowMs: 60 * MINUTE }),
  perMinute: createLimiter({ max: env.limits.turnsPerMinute, windowMs: MINUTE }),
  perDay: createLimiter({ max: env.limits.turnsPerDay, windowMs: 24 * 60 * MINUTE }),
};

function checkLimits(employeeId: string): string | undefined {
  const day = limits.perDay.take("all");
  if (!day.ok) {
    return "O assistente atingiu o limite de uso de hoje. Se for urgente, peça para falar com um analista.";
  }
  const user = limits.perUser.take(employeeId);
  if (!user.ok) {
    const minutes = Math.ceil(user.retryAfterMs / MINUTE);
    return `Você enviou muitas mensagens em pouco tempo. Tente de novo em ${String(minutes)} min.`;
  }
  const minute = limits.perMinute.take("all");
  if (!minute.ok) {
    const seconds = Math.ceil(minute.retryAfterMs / 1000);
    return `Muita gente falando com o assistente agora. Tente de novo em ${String(seconds)} s.`;
  }
  return undefined;
}

// Uma fila por conversa: dois turnos da mesma conversa nunca rodam ao mesmo tempo.
// Fica no globalThis pelo mesmo motivo do banco (o Next recarrega módulos em dev).
const cache = globalThis as unknown as { nexoAgentQueue?: Map<string, Promise<void>> };
const queue = (cache.nexoAgentQueue ??= new Map<string, Promise<void>>());

export function scheduleAgentTurn(conversationId: string): Promise<void> {
  const previous = queue.get(conversationId) ?? Promise.resolve();
  const next = previous
    .then(() => respond(conversationId))
    .catch((error: unknown) => {
      console.error("[agent] turno falhou", conversationId, error);
    });
  queue.set(conversationId, next);
  void next.finally(() => {
    if (queue.get(conversationId) === next) queue.delete(conversationId);
  });
  return next;
}

export function isAgentWorking(conversationId: string): boolean {
  return queue.has(conversationId);
}

function toHistory(m: ChatMessage): HistoryItem {
  return {
    author: m.author,
    authorName: m.authorName,
    text: m.text,
    parts: m.parts,
    steps: m.steps,
  };
}

async function respond(conversationId: string): Promise<void> {
  const loaded = await getConversation(conversationId);
  if (!loaded || !agentCanReply(loaded.conversation.status)) return;

  const history = loaded.messages.map(toChatMessage);
  const last = history.at(-1);
  // Se a última mensagem já não é do funcionário, um turno anterior respondeu a todas de uma vez.
  if (last?.author !== "employee") return;

  publish(conversationId, { type: "agent", working: true });
  try {
    if (!model) {
      await addAgentNotice(
        conversationId,
        "O assistente não está configurado neste ambiente (falta GOOGLE_GENERATIVE_AI_API_KEY).",
      );
      return;
    }

    const { conversation } = loaded;
    const limited = checkLimits(conversation.employeeId);
    if (limited) {
      await addAgentNotice(conversationId, limited);
      return;
    }

    const result = await runAgentTurn({
      model,
      client: tickets,
      employee: { id: conversation.employeeId, name: conversation.employeeName },
      history: history.slice(0, -1).map(toHistory),
      message: last.text,
    });

    if (!result.ok) {
      console.error("[agent] modelo indisponível", result.error.message);
      await addAgentNotice(
        conversationId,
        "Não consegui responder agora. Tente de novo em instantes.",
      );
      return;
    }
    await saveAgentReply(conversationId, result.value);
  } finally {
    publish(conversationId, { type: "agent", working: false });
  }
}

function toTrace(turn: AgentTurn): AgentTrace {
  return {
    decision: turn.decision,
    model: modelName,
    durationMs: turn.durationMs,
    modelCalls: turn.usage.modelCalls,
    inputTokens: turn.usage.inputTokens,
    outputTokens: turn.usage.outputTokens,
  };
}

type SaveError = { kind: "not_found" } | { kind: "paused" };

export async function saveAgentReply(
  conversationId: string,
  turn: AgentTurn,
  now = new Date(),
): Promise<Result<void, SaveError>> {
  const db = await getDb();
  const events: ConversationEvent[] = [];
  const result = await db.transaction(
    async (tx): Promise<Result<void, SaveError>> => {
      const current = await tx.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });
      if (!current) return err({ kind: "not_found" });
      // Um analista assumiu enquanto o modelo pensava: a resposta é descartada.
      if (!agentCanReply(current.status)) return err({ kind: "paused" });

      const [inserted] = await tx
        .insert(messages)
        .values({
          conversationId,
          author: "agent",
          text: turn.text,
          parts: turn.parts,
          steps: turn.steps,
          trace: toTrace(turn),
          createdAt: now,
        })
        .returning();
      if (inserted) events.push({ type: "message", message: toChatMessage(inserted) });

      if (turn.handoff) {
        const handoffEvents = await handOffInTx(
          tx,
          current,
          {
            reasons: turn.handoff.reasons,
            summary: turn.handoff.summary,
            confidence: turn.decision.confidence,
            ticketId: turn.handoff.ticketId,
            priority: turn.priority?.priority,
          },
          now,
        );
        events.push(...handoffEvents);
      } else {
        await tx
          .update(conversations)
          .set({ agentConfidence: turn.decision.confidence, updatedAt: now, lastMessageAt: now })
          .where(eq(conversations.id, conversationId));
      }
      return ok(undefined);
    },
    { behavior: "immediate" },
  );
  if (result.ok) publishAll(conversationId, events);
  return result;
}

async function addAgentNotice(conversationId: string, text: string, now = new Date()) {
  const db = await getDb();
  const [inserted] = await db
    .insert(messages)
    .values({ conversationId, author: "system", text, createdAt: now })
    .returning();
  if (inserted) publish(conversationId, { type: "message", message: toChatMessage(inserted) });
}
