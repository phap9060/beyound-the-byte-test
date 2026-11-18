import { CLOSED_BY, CONVERSATION_STATUSES, MESSAGE_AUTHORS } from "@nexo/domain";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").notNull(),
    status: text("status", { enum: CONVERSATION_STATUSES }).notNull(),
    handoffReasons: text("handoff_reasons", { mode: "json" }).$type<string[]>(),
    handoffSummary: text("handoff_summary"),
    agentConfidence: real("agent_confidence"),
    assignedAnalystId: text("assigned_analyst_id"),
    linkedTicketId: text("linked_ticket_id"),
    closedBy: text("closed_by", { enum: CLOSED_BY }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("conversations_employee_idx").on(t.employeeId),
    index("conversations_status_idx").on(t.status),
  ],
);

// O id autoincremental é o cursor do SSE: o navegador reconecta pedindo "depois do evento N".
export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    author: text("author", { enum: MESSAGE_AUTHORS }).notNull(),
    analystId: text("analyst_id"),
    text: text("text").notNull(),
    parts: text("parts", { mode: "json" }).$type<unknown[]>(),
    sessionId: text("session_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);
