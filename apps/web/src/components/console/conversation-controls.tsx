"use client";

import { Bot, CircleCheckBig, Headset, SendHorizontal } from "lucide-react";
import { useActionState, useRef } from "react";

import { analystMessageAction, conversationAction } from "@/app/console/actions";
import type { ActionState } from "@/app/console/actions";

type Action = "assume" | "return_to_agent" | "close_by_analyst";

const BUTTONS: Record<Action, { label: string; busy: string; icon: typeof Bot; style: string }> = {
  assume: {
    label: "Assumir atendimento",
    busy: "Assumindo…",
    icon: Headset,
    style: "bg-cta font-semibold text-white hover:bg-primary-hover",
  },
  return_to_agent: {
    label: "Devolver ao agent",
    busy: "Devolvendo…",
    icon: Bot,
    style: "border border-ink/12 font-medium text-ink-2 hover:bg-desk",
  },
  close_by_analyst: {
    label: "Encerrar atendimento",
    busy: "Encerrando…",
    icon: CircleCheckBig,
    style: "bg-danger-soft font-semibold text-danger-text hover:bg-danger/15",
  },
};

export function ConversationActions({ id, actions }: { id: string; actions: Action[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    conversationAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap justify-end gap-2">
        {actions.map((action) => {
          const b = BUTTONS[action];
          const Icon = b.icon;
          return (
            <button
              key={action}
              type="submit"
              name="action"
              value={action}
              disabled={pending}
              className={`flex h-9 items-center gap-[7px] rounded-lg px-3.5 text-[13.5px] disabled:cursor-wait disabled:opacity-60 max-sm:h-11 ${b.style}`}
            >
              <Icon className="size-[15px]" aria-hidden />
              {pending ? b.busy : b.label}
            </button>
          );
        })}
      </div>
      {state.error && (
        <p role="alert" className="text-[12.5px] text-danger-text">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function AnalystComposer({ id, firstName }: { id: string; firstName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    analystMessageAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-end gap-3">
        <label htmlFor="analyst-composer" className="sr-only">
          Mensagem para {firstName}
        </label>
        <textarea
          id="analyst-composer"
          name="text"
          rows={1}
          required
          maxLength={2000}
          placeholder={`Escreva para ${firstName}…`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-[12px] bg-desk px-3.5 py-[11px] text-[14.5px] outline-none placeholder:text-ink-3 focus:ring-3 focus:ring-cta/15"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Enviar"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cta text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
        >
          <SendHorizontal className="size-[18px]" aria-hidden />
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-[12.5px] text-danger-text">
          {state.error}
        </p>
      )}
    </form>
  );
}
