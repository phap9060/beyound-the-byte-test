import "server-only";

import { err, ok, transitionConversation } from "@nexo/domain";
import type { ConversationAction, ConversationStatus, Result } from "@nexo/domain";
import { and, asc, count, desc, eq } from "drizzle-orm";

import { getDb } from "./db/client";
import { conversations, messages } from "./db/schema";
import type { SessionUser } from "./session";

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

export type ConsoleFilter = "todas" | "para-voce" | "agent" | "minhas";

export interface ConsoleItem extends ConversationRow {
  lastMessage: Pick<MessageRow, "author" | "authorId" | "text"> | undefined;
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
  return db.transaction(
    async (tx) => {
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

      await tx
        .update(conversations)
        .set({
          status: next.value,
          ...assigned,
          ...(next.value === "closed" ? { closedBy: "analyst", closedAt: now } : {}),
          ...(next.value === "agent" ? { waitingUntil: null } : {}),
          updatedAt: now,
          lastMessageAt: now,
        })
        .where(and(eq(conversations.id, id), eq(conversations.status, current.status)));

      const text = SYSTEM_TEXT[action]?.(analyst);
      if (text) {
        await tx.insert(messages).values({
          conversationId: id,
          author: "system",
          authorId: analyst.id,
          authorName: analyst.name,
          text,
          createdAt: now,
        });
      }
      return ok(next.value);
    },
    { behavior: "immediate" },
  );
}

export async function sendAnalystMessage(
  id: string,
  analyst: SessionUser,
  text: string,
  now = new Date(),
): Promise<Result<void, ConversationError>> {
  const db = await getDb();
  return db.transaction(
    async (tx) => {
      const current = await tx.query.conversations.findFirst({ where: eq(conversations.id, id) });
      if (!current) return err({ kind: "not_found" });
      if (current.status !== "human") return err({ kind: "not_allowed", status: current.status });
      if (current.assignedAnalystId !== analyst.id) {
        return err({ kind: "not_yours", assignedTo: current.assignedAnalystName });
      }

      await tx.insert(messages).values({
        conversationId: id,
        author: "analyst",
        authorId: analyst.id,
        authorName: analyst.name,
        authorTeam: analyst.supportTeam ?? null,
        text,
        createdAt: now,
      });
      await tx
        .update(conversations)
        .set({ updatedAt: now, lastMessageAt: now })
        .where(eq(conversations.id, id));
      return ok(undefined);
    },
    { behavior: "immediate" },
  );
}
