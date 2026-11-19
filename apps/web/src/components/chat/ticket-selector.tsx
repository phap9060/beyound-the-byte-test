"use client";

import { TICKET_STATUS_LABEL } from "@nexo/domain";
import type { TicketView } from "@nexo/domain";

import { STATUS_DOT, formatDay } from "@/lib/format";

import { Card } from "./messages";

interface TicketSelectorProps {
  tickets: TicketView[];
  selectedId?: string | undefined;
  onSelect?: ((ticket: TicketView) => void) | undefined;
}

export function TicketSelector({ tickets, selectedId, onSelect }: TicketSelectorProps) {
  const active = selectedId === undefined && onSelect !== undefined;

  return (
    <Card>
      <div role="radiogroup" aria-label="Seus chamados abertos" className="flex flex-col">
        {tickets.map((t, i) => {
          const checked = t.id === selectedId;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={!active}
              onClick={() => onSelect?.(t)}
              className={`flex min-h-[46px] items-center gap-3.5 px-4 py-2.5 text-left transition-colors max-sm:flex-wrap max-sm:gap-x-2.5 max-sm:gap-y-1 ${
                i > 0 ? "border-t border-rule" : ""
              } ${checked ? "bg-cta/4" : "enabled:hover:bg-desk"} disabled:cursor-default`}
            >
              <span
                className={`size-4 shrink-0 rounded-full border bg-paper ${
                  checked ? "border-[5px] border-cta" : "border-ink/25"
                }`}
                aria-hidden
              />
              <span className="text-[12.5px] font-medium text-ink-3">{t.id}</span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium max-sm:basis-full max-sm:pl-[26px]">
                {t.title}
              </span>
              <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3 max-sm:pl-[26px]">
                <span className={`size-1.5 rounded-full ${STATUS_DOT[t.status]}`} aria-hidden />
                {TICKET_STATUS_LABEL[t.status]}
              </span>
              <span className="w-11 text-right text-[12.5px] text-ink-3 max-sm:w-auto">
                {formatDay(t.createdAt)}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
