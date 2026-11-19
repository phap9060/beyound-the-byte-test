"use client";

import { MAX_MESSAGES_PER_SESSION } from "@nexo/domain";
import { ArrowUp } from "lucide-react";
import { useRef, useState } from "react";
import type { KeyboardEvent, SyntheticEvent } from "react";

interface ComposerProps {
  used: number;
  onSend?: (text: string) => void;
  disabledReason?: string | undefined;
}

export function Composer({ used, onSend, disabledReason }: ComposerProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const limitReached = used >= MAX_MESSAGES_PER_SESSION;
  const blocked = limitReached || disabledReason !== undefined || !onSend;
  const canSend = !blocked && text.trim().length > 0;

  function send(e?: SyntheticEvent) {
    e?.preventDefault();
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    ref.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const plainEnter = e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey;
    if (plainEnter && !e.nativeEvent.isComposing) send(e);
  }

  const note = limitReached
    ? "Você atingiu o limite de mensagens desta sessão. Saia e entre de novo para continuar."
    : disabledReason;

  return (
    <form onSubmit={send} className="flex flex-col gap-1.5">
      <div className="flex min-h-12 items-end gap-2 rounded-[12px] border border-ink/12 bg-paper py-1.5 pr-1.5 pl-4 focus-within:border-cta focus-within:ring-3 focus-within:ring-cta/15">
        <label htmlFor="composer" className="sr-only">
          Mensagem para o Nexo Assist
        </label>
        <textarea
          ref={ref}
          id="composer"
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={onKeyDown}
          disabled={blocked}
          maxLength={2000}
          placeholder="Escreva para o Nexo…"
          className="field-sizing-content max-h-40 flex-1 resize-none self-center bg-transparent py-1.5 text-[14.5px] outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-sm bg-cta px-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowUp className="size-3.5" aria-hidden />
          <span className="max-sm:sr-only">Enviar</span>
        </button>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
        <span role={note ? "status" : undefined}>{note}</span>
        <span className={limitReached ? "font-medium text-danger-text" : ""}>
          {Math.min(used, MAX_MESSAGES_PER_SESSION)}/{MAX_MESSAGES_PER_SESSION} mensagens nesta
          sessão
        </span>
      </div>
    </form>
  );
}
