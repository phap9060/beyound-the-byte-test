import {
  AFFECTED_SCOPES,
  CATEGORIES,
  EMPLOYEE_ROLES,
  PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TICKET_UPDATE_AUTHORS,
} from "@nexo/domain";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull(),
  role: text("role", { enum: EMPLOYEE_ROLES }).notNull(),
  supportTeam: text("support_team"),
});

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: TICKET_TYPES }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category", { enum: CATEGORIES }).notNull(),
    subcategory: text("subcategory"),
    priority: text("priority", { enum: PRIORITIES }).notNull(),
    status: text("status", { enum: TICKET_STATUSES }).notNull(),
    affected: text("affected", { enum: AFFECTED_SCOPES }).notNull(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => employees.id),
    assignedTeam: text("assigned_team"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    lastSupportUpdateAt: integer("last_support_update_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("tickets_requester_idx").on(t.requesterId)],
);

export const ticketUpdates = sqliteTable(
  "ticket_updates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id),
    at: integer("at", { mode: "timestamp_ms" }).notNull(),
    author: text("author", { enum: TICKET_UPDATE_AUTHORS }).notNull(),
    message: text("message").notNull(),
  },
  (t) => [index("ticket_updates_ticket_idx").on(t.ticketId)],
);

export const kbArticles = sqliteTable("kb_articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull(),
  // separadas por vírgula
  keywords: text("keywords").notNull(),
});

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => tickets.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
