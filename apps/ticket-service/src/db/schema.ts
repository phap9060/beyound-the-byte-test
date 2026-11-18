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

/**
 * Tabelas do "sistema legado" de chamados.
 *
 * Os valores permitidos em cada coluna de enum vêm do pacote domain
 * (`CATEGORIES` etc.), então o banco e as regras nunca divergem.
 * Datas são guardadas como inteiro (milissegundos desde 1970), e o Drizzle
 * converte para `Date` na leitura.
 */

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
    id: text("id").primaryKey(), // INC-20311, REQ-10442
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
    /** Equipe para a qual o chamado foi transferido (ex.: "Suporte N2"). */
    assignedTeam: text("assigned_team"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    lastSupportUpdateAt: integer("last_support_update_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  // Toda consulta de chamados é "do funcionário X": este índice deixa isso rápido.
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

/** Artigos da central de ajuda. */
export const kbArticles = sqliteTable("kb_articles", {
  id: text("id").primaryKey(), // KB-001
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull(),
  /** Palavras-chave separadas por vírgula, usadas na busca. */
  keywords: text("keywords").notNull(),
});

/**
 * Chaves de idempotência da criação de chamado. Se o cliente repetir o mesmo
 * POST (por exemplo, num retry depois de um timeout), devolvemos o chamado
 * que já foi criado em vez de criar outro.
 */
export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => tickets.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
