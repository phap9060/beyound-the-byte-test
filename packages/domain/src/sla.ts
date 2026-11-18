import { addBusinessDays, addBusinessMinutes } from "./business-time.ts";
import { isOpenStatus } from "./ticket.ts";
import type { Priority, Ticket } from "./ticket.ts";

/**
 * Prazos por prioridade (Anexo A). O prazo vale para a primeira resposta e
 * para cada atualização: conta a partir da última atualização do service
 * desk. Passado o prazo, o chamado está vencido.
 *
 * Crítica conta em horas corridas, porque há plantão 24 horas.
 */
export type SlaPolicy =
  | { kind: "horas_corridas"; amount: number }
  | { kind: "horas_uteis"; amount: number }
  | { kind: "dias_uteis"; amount: number };

export const SLA_POLICY: Record<Priority, SlaPolicy> = {
  critica: { kind: "horas_corridas", amount: 1 },
  alta: { kind: "horas_uteis", amount: 4 },
  media: { kind: "dias_uteis", amount: 3 },
  baixa: { kind: "dias_uteis", amount: 5 },
};

/** Texto do prazo, como no protótipo: "1 hora", "4 horas úteis", "3 dias úteis". */
export function slaLabel(priority: Priority): string {
  const { kind, amount } = SLA_POLICY[priority];
  switch (kind) {
    case "horas_corridas":
      return amount === 1 ? "1 hora" : `${amount} horas`;
    case "horas_uteis":
      return amount === 1 ? "1 hora útil" : `${amount} horas úteis`;
    case "dias_uteis":
      return amount === 1 ? "1 dia útil" : `${amount} dias úteis`;
  }
}

/** Quando vence o prazo que começou em `start`. */
export function computeDueAt(start: Date, priority: Priority): Date {
  const { kind, amount } = SLA_POLICY[priority];
  switch (kind) {
    case "horas_corridas":
      return new Date(start.getTime() + amount * 60 * 60 * 1000);
    case "horas_uteis":
      return addBusinessMinutes(start, amount * 60);
    case "dias_uteis":
      return addBusinessDays(start, amount);
  }
}

export type SlaStatus =
  | { state: "no_prazo"; dueAt: Date }
  | { state: "vencido"; dueAt: Date; overdueMs: number }
  /** Chamado resolvido ou cancelado: não há prazo correndo. */
  | { state: "nao_se_aplica" };

export function getSlaStatus(
  ticket: Pick<Ticket, "status" | "priority" | "lastSupportUpdateAt">,
  now: Date,
): SlaStatus {
  if (!isOpenStatus(ticket.status)) return { state: "nao_se_aplica" };

  const dueAt = computeDueAt(ticket.lastSupportUpdateAt, ticket.priority);
  const overdueMs = now.getTime() - dueAt.getTime();

  return overdueMs > 0 ? { state: "vencido", dueAt, overdueMs } : { state: "no_prazo", dueAt };
}

export function isOverdue(
  ticket: Pick<Ticket, "status" | "priority" | "lastSupportUpdateAt">,
  now: Date,
): boolean {
  return getSlaStatus(ticket, now).state === "vencido";
}
