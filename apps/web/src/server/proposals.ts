import "server-only";

import { MessagePartSchema, PRIORITY_LABEL, err, handoffTeam, ok } from "@nexo/domain";
import type { MessagePart, Result, Ticket } from "@nexo/domain";
import type { ClientError } from "@nexo/ticket-client";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { ConversationEvent } from "@/lib/chat-types";

import { getEmployeeConversation, publishAll, toChatMessage } from "./conversations";
import { getDb } from "./db/client";
import { conversations, messages } from "./db/schema";
import { handOffInTx } from "./handoff";
import type { SessionUser } from "./session";
import { tickets } from "./tickets";

type Proposal = Extract<MessagePart, { type: "draft" | "update_draft" }>;

export type ProposalError =
  | { kind: "not_found" }
  | { kind: "already_resolved" }
  | { kind: "busy" }
  | { kind: "ticket_service"; error: ClientError };

const PartsSchema = z.array(MessagePartSchema);

// Evita dois envios do mesmo card ao mesmo tempo (duplo clique, duas abas).
const cache = globalThis as unknown as { nexoProposalLocks?: Set<string> };
const locks = (cache.nexoProposalLocks ??= new Set<string>());

async function findProposal(user: SessionUser, messageId: number, draftId: string) {
  const conversation = await getEmployeeConversation(user);
  const db = await getDb();
  const row = await db.query.messages.findFirst({
    where: and(
      eq(messages.id, messageId),
      eq(messages.conversationId, conversation.id),
      eq(messages.author, "agent"),
    ),
  });
  const parts = PartsSchema.safeParse(row?.parts ?? []);
  const proposal = parts.data?.find(
    (p): p is Proposal =>
      (p.type === "draft" || p.type === "update_draft") && p.draftId === draftId,
  );
  return row && proposal ? { conversation, proposal } : undefined;
}

// O modelo nunca escreve no sistema de chamados: só este caminho, disparado pelo clique do funcionário.
async function execute(
  user: SessionUser,
  proposal: Proposal,
): Promise<Result<Ticket, ClientError>> {
  if (proposal.type === "draft") {
    // A mesma chave em toda tentativa: se a resposta se perder, repetir não cria um segundo chamado.
    return tickets.createTicket(user.id, proposal.draft, `draft-${proposal.draftId}`);
  }
  return proposal.action === "complementar"
    ? tickets.addUpdate(user.id, proposal.ticketId, {
        author: "funcionario",
        message: proposal.message,
      })
    : tickets.reopenTicket(user.id, proposal.ticketId, proposal.message);
}

export async function resolveProposal(
  user: SessionUser,
  messageId: number,
  draftId: string,
  choice: "confirm" | "cancel",
  now = new Date(),
): Promise<Result<void, ProposalError>> {
  const found = await findProposal(user, messageId, draftId);
  if (!found) return err({ kind: "not_found" });
  if (found.proposal.state !== "pending") return err({ kind: "already_resolved" });
  if (locks.has(draftId)) return err({ kind: "busy" });

  locks.add(draftId);
  try {
    let ticket: Ticket | undefined;
    if (choice === "confirm") {
      const result = await execute(user, found.proposal);
      if (!result.ok) return err({ kind: "ticket_service", error: result.error });
      ticket = result.value;
    }
    const saved = await markResolved(found.conversation.id, messageId, draftId, ticket, now);
    if (saved.ok && ticket?.priority === "critica" && found.proposal.type === "draft") {
      // Registra no próprio chamado; se falhar, a conversa já está com o analista do mesmo jeito.
      await tickets.transferTicket(user.id, ticket.id, {
        team: handoffTeam(["caso_critico"]),
        summary: "Caso crítico aberto pelo Nexo Assist.",
      });
    }
    return saved;
  } finally {
    locks.delete(draftId);
  }
}

async function markResolved(
  conversationId: string,
  messageId: number,
  draftId: string,
  ticket: Ticket | undefined,
  now: Date,
): Promise<Result<void, ProposalError>> {
  const db = await getDb();
  const events: ConversationEvent[] = [];
  const result = await db.transaction(
    async (tx): Promise<Result<void, ProposalError>> => {
      const row = await tx.query.messages.findFirst({ where: eq(messages.id, messageId) });
      const parts = PartsSchema.safeParse(row?.parts ?? []);
      if (!row || !parts.success) return err({ kind: "not_found" });

      let resolved: Proposal | undefined;
      const nextParts = parts.data.map((p): MessagePart => {
        if ((p.type !== "draft" && p.type !== "update_draft") || p.draftId !== draftId) return p;
        if (p.state !== "pending") return p;
        resolved = !ticket
          ? { ...p, state: "cancelled" }
          : p.type === "draft"
            ? { ...p, state: "confirmed", ticketId: ticket.id }
            : { ...p, state: "confirmed" };
        return resolved;
      });
      if (!resolved) return err({ kind: "already_resolved" });

      const [updated] = await tx
        .update(messages)
        .set({ parts: nextParts })
        .where(eq(messages.id, messageId))
        .returning();
      if (updated) events.push({ type: "message_updated", message: toChatMessage(updated) });

      const current = await tx.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });
      if (current && ticket) {
        await tx
          .update(conversations)
          .set({ linkedTicketId: ticket.id, updatedAt: now })
          .where(eq(conversations.id, conversationId));

        // Anexo A: caso crítico vai para um analista. Só depois de criado, para o analista já ter o chamado.
        if (resolved.type === "draft" && ticket.priority === "critica") {
          events.push(...(await criticalHandoff(tx, current, ticket, now)));
        }
      }
      return ok(undefined);
    },
    { behavior: "immediate" },
  );
  if (result.ok) publishAll(conversationId, events);
  return result;
}

async function criticalHandoff(
  tx: Parameters<typeof handOffInTx>[0],
  current: Parameters<typeof handOffInTx>[1],
  ticket: Ticket,
  now: Date,
): Promise<ConversationEvent[]> {
  const summary = `${ticket.id} · ${ticket.title}. ${ticket.description} Prioridade ${PRIORITY_LABEL[ticket.priority]}: algo parado para um grupo de pessoas.`;
  const [notice] = await tx
    .insert(messages)
    .values({
      conversationId: current.id,
      author: "agent",
      text: "Como é um caso crítico, já chamei um analista do Suporte N2. Ele vai continuar com você por aqui em até 1 hora.",
      steps: [{ label: "transferiu para um analista", status: "done", detail: "Caso crítico" }],
      createdAt: now,
    })
    .returning();
  const events: ConversationEvent[] = notice
    ? [{ type: "message", message: toChatMessage(notice) }]
    : [];
  events.push(
    ...(await handOffInTx(
      tx,
      current,
      {
        reasons: ["caso_critico"],
        summary,
        confidence: 1,
        ticketId: ticket.id,
        priority: "critica",
      },
      now,
    )),
  );
  return events;
}
