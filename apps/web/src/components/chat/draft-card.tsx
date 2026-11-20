"use client";

import { AFFECTED_LABEL, PRIORITY_LABEL } from "@nexo/domain";
import type { TicketDraft } from "@nexo/domain";
import { CircleCheckBig } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { PRIORITY_DOT, categoryLabel, formatTime } from "@/lib/format";

import { Card } from "./messages";

export type DraftState = "pending" | "confirmed" | "cancelled";

interface DraftCardProps {
  draftId: string;
  draft: TicketDraft;
  dueAt: string;
  state: DraftState;
  ticketId?: string | undefined;
  busy?: boolean;
  onConfirm?: (() => void) | undefined;
  onEdit?: (() => void) | undefined;
  onCancel?: (() => void) | undefined;
}

const STATE_LABEL: Record<DraftState, { text: string; dot: string; color: string }> = {
  pending: { text: "Aguardando confirmação", dot: "bg-warning", color: "text-warning-text" },
  confirmed: { text: "Chamado criado", dot: "bg-success", color: "text-success-text" },
  cancelled: { text: "Cancelado", dot: "bg-ink-3", color: "text-ink-3" },
};

const noop = () => () => undefined;
function useIsMac() {
  return useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
}

export function DraftCard(props: DraftCardProps) {
  const {
    draftId,
    draft,
    dueAt,
    state,
    ticketId,
    busy = false,
    onConfirm,
    onEdit,
    onCancel,
  } = props;
  const isMac = useIsMac();
  const pending = state === "pending";
  const label = STATE_LABEL[state];

  useEffect(() => {
    if (!pending || busy || !onConfirm) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onConfirm?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [pending, busy, onConfirm]);

  return (
    <Card>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-ink-3">
          <span className="font-medium">Novo chamado</span>
          <span className="size-[3px] rounded-full bg-rule" aria-hidden />
          <span>{ticketId ?? `Rascunho ${draftId}`}</span>
          <span className={`ml-auto flex items-center gap-1.5 font-medium ${label.color}`}>
            <span className={`size-1.5 rounded-full ${label.dot}`} aria-hidden />
            {label.text}
          </span>
        </div>
        <h3 className="text-[18px] leading-tight font-semibold tracking-[-0.2px]">{draft.title}</h3>
        <p className="text-[13.5px] leading-normal text-ink-2">{draft.description}</p>
      </div>

      <dl className="mx-[18px] mb-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-rule pt-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-[12.5px] text-ink-3">Categoria</dt>
          <dd className="text-[14.5px] font-medium">
            {categoryLabel(draft.category, draft.subcategory)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[12.5px] text-ink-3">Prioridade</dt>
          <dd className="flex flex-wrap items-center gap-x-1.5 text-[14.5px] font-medium">
            <span className={`size-1.5 rounded-full ${PRIORITY_DOT[draft.priority]}`} aria-hidden />
            {PRIORITY_LABEL[draft.priority]}
            <span className="text-[13.5px] font-normal text-ink-3">
              · resposta até {formatTime(dueAt)}
            </span>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[12.5px] text-ink-3">Afetados</dt>
          <dd className="text-[14.5px] font-medium">{AFFECTED_LABEL[draft.affected]}</dd>
        </div>
      </dl>

      {pending ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule bg-desk py-2 pr-3.5 pl-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !onConfirm}
            className="flex h-9 items-center gap-2 rounded-lg bg-cta pr-2.5 pl-3.5 text-[13.5px] font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70 max-sm:h-11"
          >
            {busy ? "Criando…" : "Confirmar"}
            <kbd className="rounded-sm bg-white/15 px-[5px] py-px font-sans text-[11.5px] font-normal text-white/80 max-lg:hidden">
              {isMac ? "⌘↵" : "Ctrl ↵"}
            </kbd>
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy || !onEdit}
            className="h-9 rounded-lg border border-ink/12 bg-paper px-3.5 text-[13.5px] font-medium enabled:hover:bg-desk disabled:opacity-50 max-sm:h-11"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy || !onCancel}
            className="h-9 rounded-lg px-3.5 text-[13.5px] font-medium text-ink-2 enabled:hover:bg-paper disabled:opacity-50 max-sm:h-11"
          >
            Cancelar
          </button>
        </div>
      ) : (
        state === "confirmed" && (
          <p className="flex items-center gap-2 border-t border-rule bg-success-soft px-[18px] py-2.5 text-[13.5px] text-success-text">
            <CircleCheckBig className="size-4" aria-hidden />
            Chamado {ticketId} criado. Você recebe atualizações por aqui.
          </p>
        )
      )}
    </Card>
  );
}
