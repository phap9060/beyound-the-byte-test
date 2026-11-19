import { CATEGORY_LABEL, PRIORITY_LABEL, TICKET_STATUS_LABEL, isOpenStatus } from "@nexo/domain";
import { ArrowRightLeft, ChevronRight, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { STATUS_DOT, STATUS_TEXT, formatDay, formatListTime } from "@/lib/format";
import { tickets } from "@/server/tickets";

interface Props {
  employeeId: string;
  firstName: string;
  linkedTicketId: string | null;
  closeHref: Route;
}

export async function TicketPanel({ employeeId, firstName, linkedTicketId, closeHref }: Props) {
  const [list, linked] = await Promise.all([
    tickets.listTickets(employeeId, "all"),
    linkedTicketId ? tickets.getTicket(employeeId, linkedTicketId) : Promise.resolve(undefined),
  ]);
  const now = new Date();

  const header = (meta: string) => (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-rule pr-3.5 pl-5">
      <div className="flex flex-1 flex-col gap-0.5">
        <h2 className="text-[15.5px] font-semibold">Chamados de {firstName}</h2>
        <p className="text-[12.5px] text-ink-3">{meta}</p>
      </div>
      <Link
        href={closeHref}
        aria-label="Fechar painel"
        className="rounded-full p-2 text-ink-2 hover:bg-desk xl:hidden"
      >
        <X className="size-[18px]" />
      </Link>
    </header>
  );

  if (!list.ok) {
    return (
      <>
        {header("indisponível")}
        <p
          role="alert"
          className="m-5 rounded-lg bg-danger-soft px-3.5 py-3 text-[13.5px] text-danger-text"
        >
          Não foi possível consultar o sistema de chamados agora. Recarregue a página em instantes.
        </p>
      </>
    );
  }

  const open = list.value.filter((t) => isOpenStatus(t.status));
  const closed = list.value.filter((t) => !isOpenStatus(t.status));
  const current = linked?.ok ? linked.value : undefined;
  const others = [...open, ...closed].filter((t) => t.id !== current?.id);
  const lastUpdate = current?.updates.at(-1);

  return (
    <>
      {header(`${String(open.length)} abertos · ${String(closed.length)} encerrados`)}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        {current && (
          <section className="flex flex-col gap-3">
            <h3 className="text-[12.5px] font-semibold text-ink-3">Desta conversa</h3>
            <div className="flex flex-col gap-3.5 rounded-[12px] bg-desk p-4">
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-2">
                  <span className="flex-1 text-[12.5px] font-medium text-ink-3">{current.id}</span>
                  <span
                    className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${STATUS_TEXT[current.status]}`}
                  >
                    <span className={`size-[7px] rounded-full ${STATUS_DOT[current.status]}`} />
                    {TICKET_STATUS_LABEL[current.status]}
                  </span>
                </p>
                <p className="text-[15.5px] font-semibold">{current.title}</p>
                <p className="text-[13.5px] text-ink-3">
                  {CATEGORY_LABEL[current.category]} · prioridade{" "}
                  {PRIORITY_LABEL[current.priority].toLowerCase()}
                </p>
              </div>
              {lastUpdate && (
                <p className="flex items-start gap-2 border-t border-rule pt-3 text-[13.5px] text-ink-2">
                  <ArrowRightLeft className="mt-0.5 size-[15px] shrink-0 text-ink-3" aria-hidden />
                  <span className="flex-1">{lastUpdate.message}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {formatListTime(lastUpdate.at, now)}
                  </span>
                </p>
              )}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-1">
          <h3 className="text-[12.5px] font-semibold text-ink-3">
            {current ? "Outros chamados" : "Chamados"}
          </h3>
          {others.length === 0 && (
            <p className="py-3 text-[13.5px] text-ink-3">Nenhum outro chamado.</p>
          )}
          <ul>
            {others.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-b border-rule py-3">
                <span
                  className={`size-[7px] shrink-0 rounded-full ${STATUS_DOT[t.status]}`}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate text-[14.5px] font-medium">{t.title}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {t.id} ·{" "}
                    {t.status === "resolvido" && t.resolvedAt
                      ? `Resolvido em ${formatDay(t.resolvedAt.toISOString())}`
                      : TICKET_STATUS_LABEL[t.status]}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
