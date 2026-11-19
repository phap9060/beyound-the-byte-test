import { PRIORITY_LABEL, TICKET_STATUS_LABEL, slaLabel } from "@nexo/domain";
import type { TicketView } from "@nexo/domain";

import {
  PRIORITY_DOT,
  STATUS_DOT,
  STATUS_TEXT,
  categoryLabel,
  formatAgo,
  formatDayTime,
  formatTime,
} from "@/lib/format";

import { Card } from "./messages";

export function TicketCard({ ticket, now }: { ticket: TicketView; now: Date }) {
  const overdue = ticket.sla.state === "vencido";

  return (
    <Card>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-ink-3">
          <span className="font-medium">Chamado</span>
          <span className="size-[3px] rounded-full bg-rule" aria-hidden />
          <span>{ticket.id}</span>
          <span
            className={`ml-auto flex items-center gap-1.5 font-medium ${STATUS_TEXT[ticket.status]}`}
          >
            <span className={`size-1.5 rounded-full ${STATUS_DOT[ticket.status]}`} aria-hidden />
            {TICKET_STATUS_LABEL[ticket.status]}
          </span>
        </div>
        <h3 className="text-[18px] leading-tight font-semibold tracking-[-0.2px]">
          {ticket.title}
        </h3>
        <p className="text-[13.5px] leading-normal text-ink-2">{ticket.description}</p>
      </div>

      <dl className="mx-[18px] mb-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-3 sm:grid-cols-4">
        <Field label="Categoria">{categoryLabel(ticket.category, ticket.subcategory)}</Field>
        <Field label="Prioridade">
          <span className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${PRIORITY_DOT[ticket.priority]}`}
              aria-hidden
            />
            {PRIORITY_LABEL[ticket.priority]}
          </span>
        </Field>
        <Field label="Aberto em">{formatDayTime(ticket.createdAt)}</Field>
        <Field label="Última atualização">
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className={overdue ? "text-warning-text" : ""}>
              {formatAgo(ticket.lastSupportUpdateAt, now)}
            </span>
            {ticket.sla.state === "vencido" && (
              <span className="text-[13.5px] font-normal text-danger-text">· prazo vencido</span>
            )}
            {ticket.sla.state === "no_prazo" && (
              <span className="text-[13.5px] font-normal text-ink-3">
                · resposta até {formatTime(ticket.sla.dueAt)}
              </span>
            )}
          </span>
        </Field>
      </dl>
      <p className="sr-only">Prazo para esta prioridade: {slaLabel(ticket.priority)}.</p>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="text-[14.5px] font-medium">{children}</dd>
    </div>
  );
}
