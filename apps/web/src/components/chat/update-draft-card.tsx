import type { MessagePart } from "@nexo/domain";

import { Card } from "./messages";

type UpdateDraft = Extract<MessagePart, { type: "update_draft" }>;

const TITLE: Record<UpdateDraft["action"], string> = {
  complementar: "Complemento",
  reabrir: "Reabertura",
};

const STATE_LABEL: Record<UpdateDraft["state"], { text: string; dot: string; color: string }> = {
  pending: { text: "Aguardando confirmação", dot: "bg-warning", color: "text-warning-text" },
  confirmed: { text: "Enviado", dot: "bg-success", color: "text-success-text" },
  cancelled: { text: "Cancelado", dot: "bg-ink-3", color: "text-ink-3" },
};

interface Props {
  part: UpdateDraft;
  busy?: boolean;
  onConfirm?: (() => void) | undefined;
  onCancel?: (() => void) | undefined;
}

export function UpdateDraftCard({ part, busy = false, onConfirm, onCancel }: Props) {
  const label = STATE_LABEL[part.state];
  return (
    <Card>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-ink-3">
          <span className="font-medium">{TITLE[part.action]}</span>
          <span className="size-[3px] rounded-full bg-rule" aria-hidden />
          <span>{part.ticketId}</span>
          <span className={`ml-auto flex items-center gap-1.5 font-medium ${label.color}`}>
            <span className={`size-1.5 rounded-full ${label.dot}`} aria-hidden />
            {label.text}
          </span>
        </div>
        <h3 className="text-[16px] leading-tight font-semibold">{part.ticketTitle}</h3>
        <p className="text-[13.5px] leading-normal whitespace-pre-wrap text-ink-2">
          {part.message}
        </p>
      </div>

      {part.state === "pending" && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule bg-desk py-2 pr-3.5 pl-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !onConfirm}
            className="h-9 rounded-lg bg-cta px-3.5 text-[13.5px] font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70 max-sm:h-11"
          >
            {busy ? "Enviando…" : "Confirmar"}
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
      )}
    </Card>
  );
}
