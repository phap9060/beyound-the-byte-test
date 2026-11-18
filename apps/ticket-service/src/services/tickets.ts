import { isOpenStatus, reopenEligibility, TICKET_STATUSES } from "@nexo/domain";
import type {
  Ticket,
  TicketDraft,
  TicketStatus,
  TicketSummary,
  TicketType,
  TicketUpdateAuthor,
} from "@nexo/domain";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../db/client.ts";
import { employees, idempotencyKeys, ticketUpdates, tickets } from "../db/schema.ts";
import { AppError } from "../errors.ts";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Tx;
type TicketRow = typeof tickets.$inferSelect;

export type StatusFilter = "open" | "closed" | "all";

const FIRST_ID: Record<TicketType, number> = { INC: 20000, REQ: 10000 };

function toSummary(row: TicketRow): TicketSummary {
  const { subcategory, assignedTeam, resolvedAt, ...rest } = row;
  return {
    ...rest,
    ...(subcategory === null ? {} : { subcategory }),
    ...(assignedTeam === null ? {} : { assignedTeam }),
    ...(resolvedAt === null ? {} : { resolvedAt }),
  };
}

function statusesFor(filter: StatusFilter): TicketStatus[] {
  switch (filter) {
    case "open":
      return TICKET_STATUSES.filter(isOpenStatus);
    case "closed":
      return TICKET_STATUSES.filter((s) => !isOpenStatus(s));
    case "all":
      return [...TICKET_STATUSES];
  }
}

export async function assertEmployeeExists(db: Db, employeeId: string): Promise<void> {
  const found = await db.query.employees.findFirst({
    columns: { id: true },
    where: eq(employees.id, employeeId),
  });
  if (!found) throw new AppError("employee_not_found", "Funcionário não encontrado");
}

// Chamado de outra pessoa responde igual a um inexistente: não revela que ele existe.
async function getOwnedRow(db: Db, employeeId: string, ticketId: string): Promise<TicketRow> {
  const row = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.requesterId, employeeId)),
  });
  if (!row) throw new AppError("ticket_not_found", "Chamado não encontrado");
  return row;
}

function assertOpen(row: TicketRow): void {
  if (!isOpenStatus(row.status)) {
    throw new AppError("ticket_closed", "O chamado está encerrado e não pode ser alterado", {
      status: row.status,
    });
  }
}

export async function listTickets(
  db: Db,
  employeeId: string,
  filter: StatusFilter,
): Promise<TicketSummary[]> {
  const rows = await db.query.tickets.findMany({
    where: and(eq(tickets.requesterId, employeeId), inArray(tickets.status, statusesFor(filter))),
    orderBy: desc(tickets.createdAt),
  });
  return rows.map(toSummary);
}

export async function getTicket(db: Db, employeeId: string, ticketId: string): Promise<Ticket> {
  const row = await getOwnedRow(db, employeeId, ticketId);
  const updates = await db.query.ticketUpdates.findMany({
    columns: { at: true, author: true, message: true },
    where: eq(ticketUpdates.ticketId, ticketId),
    orderBy: asc(ticketUpdates.at),
  });
  return { ...toSummary(row), updates };
}

async function nextTicketId(db: Db, type: TicketType): Promise<string> {
  const [row] = await db
    .select({ max: sql<number | null>`max(cast(substr(${tickets.id}, 5) as integer))` })
    .from(tickets)
    .where(eq(tickets.type, type));
  const next = (row?.max ?? FIRST_ID[type]) + 1;
  return `${type}-${next}`;
}

export async function createTicket(
  db: Database,
  employeeId: string,
  draft: TicketDraft,
  idempotencyKey: string,
  now: Date,
): Promise<{ ticket: Ticket; created: boolean }> {
  return db.transaction(
    async (tx) => {
      const previous = await tx.query.idempotencyKeys.findFirst({
        where: eq(idempotencyKeys.key, idempotencyKey),
      });
      if (previous) {
        const owner = await tx.query.tickets.findFirst({
          columns: { requesterId: true },
          where: eq(tickets.id, previous.ticketId),
        });
        if (owner?.requesterId !== employeeId) {
          throw new AppError("idempotency_key_reused", "Chave de idempotência já usada");
        }
        return { ticket: await getTicket(tx, employeeId, previous.ticketId), created: false };
      }

      const id = await nextTicketId(tx, draft.type);
      await tx.insert(tickets).values({
        ...draft,
        id,
        status: "aguardando_analista",
        requesterId: employeeId,
        createdAt: now,
        lastSupportUpdateAt: now,
      });
      await tx.insert(ticketUpdates).values({
        ticketId: id,
        at: now,
        author: "agent",
        message: "Chamado aberto pelo Nexo Assist após confirmação do funcionário.",
      });
      await tx
        .insert(idempotencyKeys)
        .values({ key: idempotencyKey, ticketId: id, createdAt: now });

      return { ticket: await getTicket(tx, employeeId, id), created: true };
    },
    { behavior: "immediate" },
  );
}

export async function addUpdate(
  db: Database,
  employeeId: string,
  ticketId: string,
  update: { author: TicketUpdateAuthor; message: string },
  now: Date,
): Promise<Ticket> {
  return db.transaction(async (tx) => {
    const row = await getOwnedRow(tx, employeeId, ticketId);
    assertOpen(row);

    await tx.insert(ticketUpdates).values({ ticketId, at: now, ...update });

    // Só resposta do suporte reinicia o prazo (Anexo A).
    if (update.author === "analista") {
      await tx
        .update(tickets)
        .set({
          lastSupportUpdateAt: now,
          ...(row.status === "aguardando_analista" ? { status: "em_andamento" as const } : {}),
        })
        .where(eq(tickets.id, ticketId));
    }

    return getTicket(tx, employeeId, ticketId);
  });
}

export async function reopenTicket(
  db: Database,
  employeeId: string,
  ticketId: string,
  message: string,
  now: Date,
): Promise<Ticket> {
  return db.transaction(async (tx) => {
    const row = await getOwnedRow(tx, employeeId, ticketId);
    const eligibility = reopenEligibility(toSummary(row), now);
    if (!eligibility.eligible) {
      throw new AppError("reopen_not_allowed", "Este chamado não pode ser reaberto", {
        reason: eligibility.reason,
      });
    }

    await tx
      .update(tickets)
      .set({ status: "aguardando_analista", resolvedAt: null, lastSupportUpdateAt: now })
      .where(eq(tickets.id, ticketId));
    await tx.insert(ticketUpdates).values({
      ticketId,
      at: now,
      author: "funcionario",
      message: `Chamado reaberto: ${message}`,
    });

    return getTicket(tx, employeeId, ticketId);
  });
}

export async function transferTicket(
  db: Database,
  employeeId: string,
  ticketId: string,
  transfer: { team: string; summary: string },
  now: Date,
): Promise<Ticket> {
  return db.transaction(async (tx) => {
    const row = await getOwnedRow(tx, employeeId, ticketId);
    assertOpen(row);

    await tx.update(tickets).set({ assignedTeam: transfer.team }).where(eq(tickets.id, ticketId));
    await tx.insert(ticketUpdates).values({
      ticketId,
      at: now,
      author: "agent",
      message: `Transferido para ${transfer.team}. Resumo: ${transfer.summary}`,
    });

    return getTicket(tx, employeeId, ticketId);
  });
}
