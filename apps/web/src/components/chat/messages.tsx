import type { AgentStep } from "@nexo/domain";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

export function EmployeeMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[min(520px,85%)] rounded-[12px_12px_4px_12px] bg-ink px-4 py-[11px] text-[14.5px] leading-[1.45] break-words whitespace-pre-wrap text-white">
        {text}
      </p>
    </div>
  );
}

export function AgentMessage({ steps, children }: { steps: AgentStep[]; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        <span className="font-semibold">Nexo Assist</span>
        {steps.length > 0 && (
          <ul aria-label="O que o assistente fez" className="contents">
            {steps.map((s) => (
              <li
                key={s.label}
                className={`flex items-center gap-[5px] ${s.status === "failed" ? "text-danger-text" : "text-ink-3"}`}
              >
                {s.status === "done" ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <X className="size-3" aria-hidden />
                )}
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </div>
  );
}

export function AgentBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[600px] flex-col gap-3 rounded-[4px_12px_12px_12px] border border-rule bg-paper px-4 py-3 text-[14.5px] leading-normal">
      {children}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-ink/9 bg-paper">
      {children}
    </div>
  );
}
