import {
  CONFIDENCE_THRESHOLD,
  HANDOFF_REASON_LABEL,
  INTENT_LABEL,
  PRIORITY_LABEL,
} from "@nexo/domain";
import type { AgentToolCall, AgentTurnOutcome } from "@nexo/domain";
import { Check, ChevronRight, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatDayTime, formatListTime } from "@/lib/format";
import type { TurnItem } from "@/server/agent-turns";

import { TONE_SOFT } from "./status";
import type { Tone } from "./status";

const OUTCOME: Record<AgentTurnOutcome, { label: string; tone: Tone }> = {
  answered: { label: "Respondeu", tone: "success" },
  handed_off: { label: "Transferiu", tone: "primary" },
  discarded: { label: "Descartada: um analista assumiu", tone: "muted" },
  model_error: { label: "Modelo indisponível", tone: "danger" },
  rate_limited: { label: "Limite de uso", tone: "warning" },
  not_configured: { label: "Sem chave do modelo", tone: "danger" },
};

function percent(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}

export function TurnDetails({ turn, now }: { turn: TurnItem; now: Date }) {
  const outcome = OUTCOME[turn.outcome];
  const low = turn.confidence !== null && turn.confidence < CONFIDENCE_THRESHOLD;

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3 text-[13.5px] hover:bg-desk focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cta [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-3.5 shrink-0 text-ink-3 transition-transform group-open:rotate-90"
          aria-hidden
        />
        <time
          dateTime={turn.createdAt.toISOString()}
          title={formatDayTime(turn.createdAt.toISOString())}
          className="w-12 shrink-0 text-[12.5px] text-ink-3"
        >
          {formatListTime(turn.createdAt, now)}
        </time>
        <span className="w-32 shrink-0 truncate font-semibold">{turn.employeeName}</span>
        <span className="min-w-40 flex-1 truncate text-ink-2">{turn.message}</span>
        {turn.confidence !== null && (
          <span className={`text-[12.5px] font-medium ${low ? "text-danger-text" : "text-ink-3"}`}>
            confiança {percent(turn.confidence)}
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TONE_SOFT[outcome.tone]}`}
        >
          {outcome.label}
        </span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-rule bg-desk px-3.5 py-4 text-[13px]">
        <Group title="Mensagem do funcionário">
          <p className="break-words whitespace-pre-wrap">{turn.message}</p>
        </Group>

        {turn.trace && (
          <Group title="O que o modelo julgou">
            <dl className="flex flex-col gap-1.5">
              <Row label="Entendeu">{turn.trace.decision.understood}</Row>
              <Row label="Intenção">{INTENT_LABEL[turn.trace.decision.intent]}</Row>
              <Row label="Confiança">{percent(turn.trace.decision.confidence)}</Row>
              <Row label="Por quê">{turn.trace.decision.reason}</Row>
            </dl>
          </Group>
        )}

        <Group title="O que o código decidiu">
          <dl className="flex flex-col gap-1.5">
            <Row label="Resultado">{outcome.label}</Row>
            {turn.trace && (
              <Row label={turn.outcome === "discarded" ? "Ação planejada" : "Ação"}>
                {turn.trace.decision.action}
              </Row>
            )}
            {turn.priority && (
              <Row label="Prioridade">
                {PRIORITY_LABEL[turn.priority.priority]}: {turn.priority.reason}{" "}
                <code className="text-[12px] text-ink-3">{turn.priority.rule}</code>
              </Row>
            )}
            {turn.handoffReasons && turn.handoffReasons.length > 0 && (
              <Row label="Transferência">
                {turn.handoffReasons.map((r) => HANDOFF_REASON_LABEL[r]).join(" · ")}
              </Row>
            )}
            {turn.error && (
              <Row label="Erro">
                <span className="break-words text-danger-text">{turn.error}</span>
              </Row>
            )}
          </dl>
        </Group>

        {turn.steps.length > 0 && (
          <Group title="Passos">
            <ol className="flex flex-col gap-1">
              {turn.steps.map((s, i) => (
                <li key={`${s.label}-${String(i)}`} className="flex gap-2">
                  <Status status={s.status} />
                  <span>
                    <span className="font-medium">{s.label}</span>
                    {s.detail && <span className="text-ink-2"> · {s.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Group>
        )}

        {turn.toolCalls.length > 0 && (
          <Group title="Ferramentas, na ordem em que o modelo pediu">
            <ol className="flex flex-col gap-2">
              {turn.toolCalls.map((call, i) => (
                <li key={`${call.tool}-${String(i)}`}>
                  <ToolCall call={call} position={i + 1} />
                </li>
              ))}
            </ol>
          </Group>
        )}

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-3 text-[11.5px] text-ink-3">
          <span className="flex-1">
            {[
              turn.trace?.model,
              turn.durationMs === null ? undefined : `${(turn.durationMs / 1000).toFixed(1)} s`,
              turn.trace &&
                `${String(turn.trace.modelCalls)} chamada(s) ao modelo · ${turn.trace.inputTokens.toLocaleString("pt-BR")} tokens de entrada, ${turn.trace.outputTokens.toLocaleString("pt-BR")} de saída`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <Link
            href={`/console/${turn.conversationId}` as Route}
            className="font-semibold text-primary-text hover:underline"
          >
            Abrir conversa
          </Link>
        </footer>
      </div>
    </details>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-[12px] font-semibold text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[112px_1fr] sm:gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Status({ status }: { status: AgentToolCall["status"] }) {
  return status === "done" ? (
    <Check className="mt-0.5 size-3.5 shrink-0 text-success-text" aria-label="feito" />
  ) : (
    <X className="mt-0.5 size-3.5 shrink-0 text-danger-text" aria-label="falhou" />
  );
}

function ToolCall({ call, position }: { call: AgentToolCall; position: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-rule bg-paper px-3 py-2.5">
      <p className="flex gap-2">
        <Status status={call.status} />
        <span className="font-medium">
          {position}. <code>{call.tool}</code>
        </span>
      </p>
      <Payload label="Pediu" json={call.args} />
      {call.result !== undefined && <Payload label="Recebeu" json={call.result} />}
    </div>
  );
}

// O registro é cortado no limite de tamanho, então pode não ser um JSON completo.
function pretty(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function Payload({ label, json }: { label: string; json: string }) {
  return (
    <details>
      <summary className="w-fit cursor-pointer text-[12px] text-ink-3 hover:text-ink-2">
        {label}
      </summary>
      <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-desk px-3 py-2 font-mono text-[12px] break-words whitespace-pre-wrap">
        {pretty(json)}
      </pre>
    </details>
  );
}
