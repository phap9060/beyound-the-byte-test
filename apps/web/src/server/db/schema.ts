import {
  AGENT_TURN_OUTCOMES,
  CLOSED_BY,
  CONVERSATION_STATUSES,
  INTENTS,
  MESSAGE_AUTHORS,
} from "@nexo/domain";
import type { AgentStep, HandoffReason } from "@nexo/domain";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").notNull(),
    // Cópia dos dados do funcionário no início da conversa: a lista do console não depende do serviço de chamados.
    employeeName: text("employee_name").notNull(),
    employeeEmail: text("employee_email").notNull(),
    employeeDepartment: text("employee_department").notNull(),
    status: text("status", { enum: CONVERSATION_STATUSES }).notNull(),
    handoffReasons: text("handoff_reasons", { mode: "json" }).$type<HandoffReason[]>(),
    handoffSummary: text("handoff_summary"),
    handoffTeam: text("handoff_team"),
    agentConfidence: real("agent_confidence"),
    linkedTicketId: text("linked_ticket_id"),
    assignedAnalystId: text("assigned_analyst_id"),
    assignedAnalystName: text("assigned_analyst_name"),
    closedBy: text("closed_by", { enum: CLOSED_BY }),
    handedOffAt: timestamp("handed_off_at"),
    waitingUntil: timestamp("waiting_until"),
    assignedAt: timestamp("assigned_at"),
    closedAt: timestamp("closed_at"),
    lastMessageAt: timestamp("last_message_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
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
    authorId: text("author_id"),
    authorName: text("author_name"),
    authorTeam: text("author_team"),
    text: text("text").notNull(),
    parts: text("parts", { mode: "json" }).$type<unknown[]>(),
    steps: text("steps", { mode: "json" }).$type<AgentStep[]>(),
    trace: text("trace", { mode: "json" }).$type<unknown>(),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);

// Uma linha por turno do agent, inclusive os que falharam ou foram descartados e não viraram resposta.
export const agentTurns = sqliteTable(
  "agent_turns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    employeeMessageId: integer("employee_message_id")
      .notNull()
      .references(() => messages.id),
    replyMessageId: integer("reply_message_id").references(() => messages.id),
    outcome: text("outcome", { enum: AGENT_TURN_OUTCOMES }).notNull(),
    intent: text("intent", { enum: INTENTS }),
    confidence: real("confidence"),
    handoffReasons: text("handoff_reasons", { mode: "json" }).$type<HandoffReason[]>(),
    priority: text("priority", { mode: "json" }).$type<unknown>(),
    toolCalls: text("tool_calls", { mode: "json" }).$type<unknown[]>(),
    steps: text("steps", { mode: "json" }).$type<AgentStep[]>(),
    trace: text("trace", { mode: "json" }).$type<unknown>(),
    error: text("error"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => [index("agent_turns_conversation_idx").on(t.conversationId)],
);
