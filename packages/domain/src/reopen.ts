import type { Ticket } from "./ticket.ts";

/** Chamados resolvidos há até 7 dias podem ser reabertos (Anexo A). */
export const REOPEN_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReopenEligibility =
  { eligible: true } | { eligible: false; reason: "nao_resolvido" | "janela_expirada" };

export function reopenEligibility(
  ticket: Pick<Ticket, "status" | "resolvedAt">,
  now: Date,
): ReopenEligibility {
  if (ticket.status !== "resolvido" || ticket.resolvedAt === undefined) {
    return { eligible: false, reason: "nao_resolvido" };
  }

  const elapsedMs = now.getTime() - ticket.resolvedAt.getTime();
  return elapsedMs <= REOPEN_WINDOW_DAYS * DAY_MS
    ? { eligible: true }
    : { eligible: false, reason: "janela_expirada" };
}

export function canReopen(ticket: Pick<Ticket, "status" | "resolvedAt">, now: Date): boolean {
  return reopenEligibility(ticket, now).eligible;
}
