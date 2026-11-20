import "server-only";

import { handoffDeadline, handoffTeam, transitionConversation } from "@nexo/domain";
import type { HandoffReason, Priority } from "@nexo/domain";
import { eq } from "drizzle-orm";

import type { ConversationEvent } from "@/lib/chat-types";

import type { Database } from "./db/client";
import { conversations, messages } from "./db/schema";
import { toChatMessage, toState } from "./conversations";
import type { ConversationRow } from "./conversations";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface HandoffInput {
  reasons: HandoffReason[];
  summary: string;
  confidence: number;
  ticketId?: string | undefined;
  priority?: Priority | undefined;
}

// Passa a conversa para "aguardando analista" dentro de uma transação já aberta.
// Retorna os eventos para publicar depois do commit, ou nada se a conversa não estava com o agent.
export async function handOffInTx(
  tx: Tx,
  current: ConversationRow,
  input: HandoffInput,
  now: Date,
): Promise<ConversationEvent[]> {
  const next = transitionConversation(current.status, "handoff");
  if (!next.ok) return [];

  const team = handoffTeam(input.reasons);
  const priority = input.reasons.includes("caso_critico") ? "critica" : input.priority;
  const [updated] = await tx
    .update(conversations)
    .set({
      status: next.value,
      handoffReasons: input.reasons,
      handoffSummary: input.summary,
      handoffTeam: team,
      agentConfidence: input.confidence,
      linkedTicketId: input.ticketId ?? current.linkedTicketId,
      handedOffAt: now,
      waitingUntil: handoffDeadline(now, priority),
      updatedAt: now,
      lastMessageAt: now,
    })
    .where(eq(conversations.id, current.id))
    .returning();

  const [system] = await tx
    .insert(messages)
    .values({
      conversationId: current.id,
      author: "system",
      text: `Transferida para ${team}`,
      createdAt: now,
    })
    .returning();

  const events: ConversationEvent[] = [];
  if (system) events.push({ type: "message", message: toChatMessage(system) });
  if (updated) events.push({ type: "state", state: toState(updated) });
  return events;
}
