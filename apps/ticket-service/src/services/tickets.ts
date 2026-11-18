import { isOpenStatus, ok, reopenEligibility, TICKET_STATUSES } from "@nexo/domain";
import type {
  Result,
  Ticket,
  TicketDraft,
  TicketStatus,
  TicketSummary,
  TicketType,
  TicketUpdateAuthor,
} from "@nexo/domain";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../db/client.ts";
import { idempotencyKeys, ticketUpdates, tickets } from "../db/schema.ts";
import { fail } from "../errors.ts";
import type { ServiceError } from "../errors.ts";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Tx;
type TicketRow = typeof tickets.$inferSelect;
type TicketResult = Result<Ticket, ServiceError>;

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

// Chamado de outra pessoa responde igual a um inexistente: não revela que ele existe.
async function findOwnedRow(
  db: Db,
  employeeId: string,
  ticketId: string,
): Promise<Result<TicketRow, ServiceError>> {
  const row = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.requesterId, employeeId)),
  });
  return row ? ok(row) : fail("ticket_not_found", "Chamado não encontrado");
}

async function findOwnedOpenRow(
  db: Db,
  employeeId: string,
  ticketId: string,
): Promise<Result<TicketRow, ServiceError>> {
  const found = await findOwnedRow(db, employeeId, ticketId);
  if (!found.ok) return found;
  if (!isOpenStatus(found.value.status)) {
    return fail("ticket_closed", "O chamado está encerrado e não pode ser alterado", {
      status: found.value.status,
    });
  }
  return found;
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

export async function getTicket(
  db: Db,
  employeeId: string,
  ticketId: string,
): Promise<TicketResult> {
  const found = await findOwnedRow(db, employeeId, ticketId);
  if (!found.ok) return found;

  const updates = await db.query.ticketUpdates.findMany({
    columns: { at: true, author: true, message: true },
    where: eq(ticketUpdates.ticketId, ticketId),
    orderBy: asc(ticketUpdates.at),
  });
  return ok({ ...toSummary(found.value), updates });
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
): Promise<Result<{ ticket: Ticket; created: boolean }, ServiceError>> {
  return db.transaction(
    async (tx) => {
      const previous = await tx.query.idempotencyKeys.findFirst({
        where: eq(idempotencyKeys.key, idempotencyKey),
      });
      if (previous) {
        const existing = await getTicket(tx, employeeId, previous.ticketId);
        if (!existing.ok) return fail("idempotency_key_reused", "Chave de idempotência já usada");
        return ok({ ticket: existing.value, created: false });
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

      const created = await getTicket(tx, employeeId, id);
      return created.ok ? ok({ ticket: created.value, created: true }) : created;
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
): Promise<TicketResult> {
  return db.transaction(async (tx) => {
    const found = await findOwnedOpenRow(tx, employeeId, ticketId);
    if (!found.ok) return found;

    await tx.insert(ticketUpdates).values({ ticketId, at: now, ...update });

    // Só resposta do suporte reinicia o prazo (Anexo A).
    if (update.author === "analista") {
      await tx
        .update(tickets)
        .set({
          lastSupportUpdateAt: now,
          ...(found.value.status === "aguardando_analista"
            ? { status: "em_andamento" as const }
            : {}),
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
): Promise<TicketResult> {
  return db.transaction(async (tx) => {
    const found = await findOwnedRow(tx, employeeId, ticketId);
    if (!found.ok) return found;

    const eligibility = reopenEligibility(toSummary(found.value), now);
    if (!eligibility.eligible) {
      return fail("reopen_not_allowed", "Este chamado não pode ser reaberto", {
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
): Promise<TicketResult> {
  return db.transaction(async (tx) => {
    const found = await findOwnedOpenRow(tx, employeeId, ticketId);
    if (!found.ok) return found;

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
