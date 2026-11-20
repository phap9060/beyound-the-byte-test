import "server-only";

import {
  AgentTraceSchema,
  MAX_MESSAGES_PER_SESSION,
  MessagePartSchema,
  err,
  ok,
  transitionConversation,
} from "@nexo/domain";
import type { ConversationAction, ConversationStatus, Result } from "@nexo/domain";
import { and, asc, count, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import type { ChatMessage, ConversationEvent, ConversationState } from "@/lib/chat-types";

import { getDb } from "./db/client";
import { conversations, messages } from "./db/schema";
import { publish } from "./events";
import type { SessionUser } from "./session";

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

export type ConsoleFilter = "todas" | "para-voce" | "agent" | "minhas";

export interface ConsoleItem extends ConversationRow {
  lastMessage: Pick<MessageRow, "author" | "authorId" | "text"> | undefined;
}

const PartsSchema = z.array(MessagePartSchema);

export function toChatMessage(row: MessageRow): ChatMessage {
  const parts = PartsSchema.safeParse(row.parts ?? []);
  return {
    id: row.id,
    author: row.author,
    authorName: row.authorName,
    authorTeam: row.authorTeam,
    text: row.text,
    parts: parts.success ? parts.data : [],
    steps: row.steps ?? [],
    trace: AgentTraceSchema.safeParse(row.trace).data ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toState(c: ConversationRow): ConversationState {
  return {
    status: c.status,
    analystName: c.assignedAnalystName,
    waitingUntil: c.waitingUntil?.toISOString() ?? null,
  };
}

export function publishAll(conversationId: string, events: ConversationEvent[]): void {
  for (const event of events) publish(conversationId, event);
}

export async function messagesAfter(conversationId: string, afterId: number) {
  const db = await getDb();
  const rows = await db.query.messages.findMany({
    where: and(eq(messages.conversationId, conversationId), gt(messages.id, afterId)),
    orderBy: asc(messages.id),
  });
  return rows.map(toChatMessage);
}

export async function countSessionMessages(sessionId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ total: count() })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.author, "employee")));
  return row?.total ?? 0;
}

function matches(filter: ConsoleFilter, c: ConversationRow, analystId: string): boolean {
  switch (filter) {
    case "todas":
      return true;
    case "para-voce":
      return c.status === "waiting_human";
    case "agent":
      return c.status === "agent";
    case "minhas":
      return c.status === "human" && c.assignedAnalystId === analystId;
  }
}

const STATUS_ORDER: Record<ConversationStatus, number> = {
  waiting_human: 0,
  human: 1,
  agent: 2,
  closed: 3,
};

// Volume de protótipo: carregar tudo e filtrar em memória é simples e suficiente.
export async function listConsole(analystId: string, filter: ConsoleFilter, query: string) {
  const db = await getDb();
  const rows = await db.query.conversations.findMany({
    orderBy: desc(conversations.lastMessageAt),
  });
  const last = await Promise.all(
    rows.map((c) =>
      db.query.messages.findFirst({
        columns: { author: true, authorId: true, text: true },
        where: eq(messages.conversationId, c.id),
        orderBy: desc(messages.id),
      }),
    ),
  );

  const q = query.trim().toLowerCase();
  const all: ConsoleItem[] = rows
    .map((c, i) => ({ ...c, lastMessage: last[i] }))
    .filter(
      (c) =>
        !q ||
        c.employeeName.toLowerCase().includes(q) ||
        (c.linkedTicketId?.toLowerCase().includes(q) ?? false),
    );

  const counts: Record<ConsoleFilter, number> = {
    todas: all.length,
    "para-voce": all.filter((c) => matches("para-voce", c, analystId)).length,
    agent: all.filter((c) => matches("agent", c, analystId)).length,
    minhas: all.filter((c) => matches("minhas", c, analystId)).length,
  };

  const items = all
    .filter((c) => matches(filter, c, analystId))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return { items, counts };
}

export async function getConversationRow(id: string) {
  const db = await getDb();
  return db.query.conversations.findFirst({ where: eq(conversations.id, id) });
}

export async function getConversation(id: string) {
  const db = await getDb();
  const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, id) });
  if (!conversation) return undefined;
  const history = await db.query.messages.findMany({
    where: eq(messages.conversationId, id),
    orderBy: asc(messages.id),
  });
  return { conversation, messages: history };
}

export type ConversationError =
  | { kind: "not_found" }
  | { kind: "limit_reached" }
  | { kind: "not_allowed"; status: ConversationStatus }
  | { kind: "not_yours"; assignedTo: string | null };

const SYSTEM_TEXT: Partial<Record<ConversationAction, (analyst: SessionUser) => string>> = {
  assume: (a) => `${a.name} assumiu · agent pausado`,
  return_to_agent: (a) => `${a.name} devolveu ao agent`,
  close_by_analyst: (a) => `Atendimento encerrado por ${a.name}`,
};

// A atualização só vale se o status ainda for o que foi lido: dois analistas não assumem a mesma conversa.
export async function applyAnalystAction(
  id: string,
  action: "assume" | "return_to_agent" | "close_by_analyst",
  analyst: SessionUser,
  now = new Date(),
): Promise<Result<ConversationStatus, ConversationError>> {
  const db = await getDb();
  const events: ConversationEvent[] = [];
  const result = await db.transaction(
    async (tx): Promise<Result<ConversationStatus, ConversationError>> => {
      const current = await tx.query.conversations.findFirst({ where: eq(conversations.id, id) });
      if (!current) return err({ kind: "not_found" });

      const mine = current.assignedAnalystId === analyst.id;
      if (current.status === "human" && !mine) {
        return err({ kind: "not_yours", assignedTo: current.assignedAnalystName });
      }

      const next = transitionConversation(current.status, action);
      if (!next.ok) return err({ kind: "not_allowed", status: current.status });

      const assigned =
        next.value === "human"
          ? { assignedAnalystId: analyst.id, assignedAnalystName: analyst.name, assignedAt: now }
          : { assignedAnalystId: null, assignedAnalystName: null, assignedAt: null };

      const [updated] = await tx
        .update(conversations)
        .set({
          status: next.value,
          ...assigned,
          ...(next.value === "closed" ? { closedBy: "analyst", closedAt: now } : {}),
          ...(next.value === "agent" ? { waitingUntil: null } : {}),
          updatedAt: now,
          lastMessageAt: now,
        })
        .where(and(eq(conversations.id, id), eq(conversations.status, current.status)))
        .returning();
      if (updated) events.push({ type: "state", state: toState(updated) });

      const text = SYSTEM_TEXT[action]?.(analyst);
      if (text) {
        const [inserted] = await tx
          .insert(messages)
          .values({
            conversationId: id,
            author: "system",
            authorId: analyst.id,
            authorName: analyst.name,
            text,
            createdAt: now,
          })
          .returning();
        if (inserted) events.push({ type: "message", message: toChatMessage(inserted) });
      }
      return ok(next.value);
    },
    { behavior: "immediate" },
  );
  if (result.ok) publishAll(id, events);
  return result;
}

export async function sendAnalystMessage(
  id: string,
  analyst: SessionUser,
  text: string,
  now = new Date(),
): Promise<Result<void, ConversationError>> {
  const db = await getDb();
  const events: ConversationEvent[] = [];
  const result = await db.transaction(
    async (tx): Promise<Result<void, ConversationError>> => {
      const current = await tx.query.conversations.findFirst({ where: eq(conversations.id, id) });
      if (!current) return err({ kind: "not_found" });
      if (current.status !== "human") return err({ kind: "not_allowed", status: current.status });
      if (current.assignedAnalystId !== analyst.id) {
        return err({ kind: "not_yours", assignedTo: current.assignedAnalystName });
      }

      const [inserted] = await tx
        .insert(messages)
        .values({
          conversationId: id,
          author: "analyst",
          authorId: analyst.id,
          authorName: analyst.name,
          authorTeam: analyst.supportTeam ?? null,
          text,
          createdAt: now,
        })
        .returning();
      if (inserted) events.push({ type: "message", message: toChatMessage(inserted) });
      await tx
        .update(conversations)
        .set({ updatedAt: now, lastMessageAt: now })
        .where(eq(conversations.id, id));
      return ok(undefined);
    },
    { behavior: "immediate" },
  );
  if (result.ok) publishAll(id, events);
  return result;
}

// A conversa do funcionário é contínua: ao voltar outro dia, ele continua de onde parou (história 6).
export async function getEmployeeConversation(user: SessionUser): Promise<ConversationRow> {
  const db = await getDb();
  const existing = await db.query.conversations.findFirst({
    where: eq(conversations.employeeId, user.id),
    orderBy: desc(conversations.createdAt),
  });
  if (existing) return existing;

  const now = new Date();
  const created: ConversationRow = {
    id: crypto.randomUUID(),
    employeeId: user.id,
    employeeName: user.name,
    employeeEmail: user.email,
    employeeDepartment: user.department,
    status: "agent",
    handoffReasons: null,
    handoffSummary: null,
    handoffTeam: null,
    agentConfidence: null,
    linkedTicketId: null,
    assignedAnalystId: null,
    assignedAnalystName: null,
    closedBy: null,
    handedOffAt: null,
    waitingUntil: null,
    assignedAt: null,
    closedAt: null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(conversations).values(created);
  return created;
}

export async function postEmployeeMessage(
  user: SessionUser & { sessionId: string },
  text: string,
  now = new Date(),
): Promise<Result<{ message: ChatMessage; conversationId: string }, ConversationError>> {
  if ((await countSessionMessages(user.sessionId)) >= MAX_MESSAGES_PER_SESSION) {
    return err({ kind: "limit_reached" });
  }

  const conversation = await getEmployeeConversation(user);
  const db = await getDb();
  const events: ConversationEvent[] = [];

  const result = await db.transaction(
    async (
      tx,
    ): Promise<Result<{ message: ChatMessage; conversationId: string }, ConversationError>> => {
      const current = await tx.query.conversations.findFirst({
        where: eq(conversations.id, conversation.id),
      });
      if (!current) return err({ kind: "not_found" });

      const reopen = transitionConversation(current.status, "employee_writes");
      const [updated] = await tx
        .update(conversations)
        .set({
          ...(reopen.ok ? { status: reopen.value, closedBy: null, closedAt: null } : {}),
          updatedAt: now,
          lastMessageAt: now,
        })
        .where(eq(conversations.id, current.id))
        .returning();
      if (reopen.ok && updated) events.push({ type: "state", state: toState(updated) });

      const [inserted] = await tx
        .insert(messages)
        .values({
          conversationId: current.id,
          author: "employee",
          authorId: user.id,
          authorName: user.name,
          text,
          sessionId: user.sessionId,
          createdAt: now,
        })
        .returning();
      if (!inserted) return err({ kind: "not_found" });

      const message = toChatMessage(inserted);
      events.push({ type: "message", message });
      return ok({ message, conversationId: current.id });
    },
    { behavior: "immediate" },
  );

  if (result.ok) publishAll(conversation.id, events);
  return result;
}
