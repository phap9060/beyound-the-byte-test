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

export function AnalystMessage({
  name,
  team,
  text,
}: {
  name: string;
  team: string | null;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[12.5px]">
        <span className="font-semibold">{name}</span>
        <span className="rounded-sm bg-success-soft px-1.5 py-px text-[11px] font-semibold text-success-text">
          {team ?? "Analista"}
        </span>
      </div>
      <p className="w-fit max-w-[600px] rounded-[4px_12px_12px_12px] bg-[#E3F4EA] px-4 py-3 text-[14.5px] leading-normal break-words whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

export function SystemLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="status">
      <span className="h-px flex-1 bg-rule" />
      <span className="text-center text-[12px] font-medium text-ink-3">{text}</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
