import { CONFIDENCE_THRESHOLD, INTENT_LABEL } from "@nexo/domain";
import type { AgentStep, AgentTrace } from "@nexo/domain";
import { Check, ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";

function confidenceTone(value: number) {
  if (value < CONFIDENCE_THRESHOLD) return { bar: "bg-danger", text: "text-danger-text" };
  if (value < 0.8) return { bar: "bg-warning", text: "text-warning-text" };
  return { bar: "bg-success", text: "text-success-text" };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[112px_1fr] sm:gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

export function DecisionDetails({ trace, steps }: { trace: AgentTrace; steps: AgentStep[] }) {
  const { decision } = trace;
  const percent = Math.round(decision.confidence * 100);
  const tone = confidenceTone(decision.confidence);

  return (
    <details className="group w-full max-w-[600px] text-[13px]">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-[12.5px] text-ink-3 hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-cta [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
        Por que respondi assim
        <span className={`font-medium ${tone.text}`}>· confiança {percent}%</span>
      </summary>

      <div className="mt-2 flex flex-col gap-3 rounded-[10px] border border-rule bg-desk px-3.5 py-3">
        <dl className="flex flex-col gap-2 leading-normal">
          <Row label="Entendi">{decision.understood}</Row>
          <Row label="Intenção">{INTENT_LABEL[decision.intent]}</Row>
          <Row label="Ação">{decision.action}</Row>
          <Row label="Confiança">
            <span className="flex items-center gap-2">
              <span
                className="h-1.5 w-24 overflow-hidden rounded-full bg-rule"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label="Confiança"
              >
                <span
                  className={`block h-full ${tone.bar}`}
                  style={{ width: `${String(percent)}%` }}
                />
              </span>
              <span className={`font-medium ${tone.text}`}>{percent}%</span>
              {decision.confidence < CONFIDENCE_THRESHOLD && (
                <span className="text-ink-3">
                  abaixo de {CONFIDENCE_THRESHOLD * 100}%: vai para um analista
                </span>
              )}
            </span>
          </Row>
          <Row label="Por quê">{decision.reason}</Row>
        </dl>

        {steps.length > 0 && (
          <ol className="flex flex-col gap-1.5 border-t border-rule pt-2.5" aria-label="Passos">
            {steps.map((s, i) => (
              <li key={`${s.label}-${String(i)}`} className="flex gap-2">
                {s.status === "done" ? (
                  <Check
                    className="mt-0.5 size-3.5 shrink-0 text-success-text"
                    aria-label="feito"
                  />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0 text-danger-text" aria-label="falhou" />
                )}
                <span>
                  <span className="font-medium">{s.label}</span>
                  {s.detail && <span className="text-ink-2"> · {s.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className="border-t border-rule pt-2 text-[11.5px] text-ink-3">
          {trace.model} · {(trace.durationMs / 1000).toFixed(1)} s · {trace.modelCalls}{" "}
          {trace.modelCalls === 1 ? "chamada" : "chamadas"} ao modelo ·{" "}
          {trace.inputTokens.toLocaleString("pt-BR")} tokens de entrada,{" "}
          {trace.outputTokens.toLocaleString("pt-BR")} de saída
        </p>
      </div>
    </details>
  );
}
