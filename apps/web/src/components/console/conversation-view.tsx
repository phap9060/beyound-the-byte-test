import { HANDOFF_REASON_LABEL } from "@nexo/domain";
import {
  ArrowLeft,
  ArrowRightLeft,
  Bot,
  CheckCheck,
  CircleCheckBig,
  Hand,
  Headset,
  Lock,
  PanelRight,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { formatDayLabel, formatTime } from "@/lib/format";
import type { ConversationRow, MessageRow } from "@/server/conversations";

import { Avatar } from "./avatar";
import { AnalystComposer, ConversationActions } from "./conversation-controls";
import { TONE_SOFT, statusTag, waitingText } from "./status";

interface Props {
  conversation: ConversationRow;
  messages: MessageRow[];
  analystId: string;
  backHref: Route;
  panelHref: Route;
}

export function ConversationView({
  conversation: c,
  messages,
  analystId,
  backHref,
  panelHref,
}: Props) {
  const now = new Date();
  const firstName = c.employeeName.split(" ")[0] ?? c.employeeName;
  const mine = c.status === "human" && c.assignedAnalystId === analystId;
  const tag = statusTag(c, analystId, now);
  const meta = [c.employeeDepartment, c.linkedTicketId].filter(Boolean).join(" · ");

  return (
    <section
      aria-label={`Conversa com ${c.employeeName}`}
      className="flex min-w-0 flex-1 flex-col bg-thread"
    >
      <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-rule bg-paper py-3 pr-4 pl-3 sm:pl-5">
        <Link
          href={backHref}
          aria-label="Voltar para a lista"
          className="rounded-full p-1.5 text-ink-2 hover:bg-desk lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar name={c.employeeName} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-[15.5px] font-semibold">{c.employeeName}</h2>
          <p className="truncate text-[12.5px] text-ink-3">{meta}</p>
        </div>
        {mine ? (
          <ConversationActions id={c.id} actions={["return_to_agent", "close_by_analyst"]} />
        ) : (
          <span
            className={`flex items-center gap-[7px] rounded-full px-[11px] py-1.5 text-[12.5px] font-semibold ${TONE_SOFT[tag.tone]}`}
          >
            <Bot className="size-3.5" aria-hidden />
            {c.status === "waiting_human" ? "Aguardando atendente" : tag.label}
          </span>
        )}
        <Link
          href={panelHref}
          aria-label="Chamados do funcionário"
          className="rounded-full p-2 text-ink-2 hover:bg-desk xl:hidden"
        >
          <PanelRight className="size-[18px]" />
        </Link>
      </header>

      <ol className="flex flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6" aria-label="Mensagens">
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const day = formatDayLabel(m.createdAt, now);
          const newDay = !prev || formatDayLabel(prev.createdAt, now) !== day;
          return (
            <Fragment key={m.id}>
              {newDay && (
                <li className="flex justify-center pt-2 pb-1">
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-medium text-ink-3">
                    {day}
                  </span>
                </li>
              )}
              <MessageItem message={m} />
            </Fragment>
          );
        })}
        {c.status !== "agent" && c.handoffSummary && <HandoffSummary conversation={c} />}
      </ol>

      <footer className="flex flex-col gap-2.5 border-t border-rule bg-paper px-4 pt-3 pb-3.5 sm:px-5">
        <Footer conversation={c} mine={mine} firstName={firstName} now={now} />
      </footer>
    </section>
  );
}

function Footer({
  conversation: c,
  mine,
  firstName,
  now,
}: {
  conversation: ConversationRow;
  mine: boolean;
  firstName: string;
  now: Date;
}) {
  if (mine) return <AnalystComposer id={c.id} firstName={firstName} />;

  if (c.status === "closed") {
    const by = c.closedBy === "agent" ? "pelo agent" : "por um analista";
    const when = c.closedAt ? ` · ${formatTime(c.closedAt.toISOString())}` : "";
    return <Notice icon={CircleCheckBig} title={`Conversa encerrada ${by}${when}`} />;
  }

  if (c.status === "human") {
    return (
      <Notice
        icon={Headset}
        title={`Em atendimento com ${c.assignedAnalystName ?? "outro analista"}`}
        body="Somente quem assumiu pode responder."
      />
    );
  }

  const waiting = c.status === "waiting_human";
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${waiting ? "bg-warning-soft text-warning-text" : "bg-violet-soft text-violet-text"}`}
        >
          {waiting ? (
            <Hand className="size-[17px]" aria-hidden />
          ) : (
            <Bot className="size-[17px]" aria-hidden />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[14.5px] font-semibold">
            {waiting ? `${firstName} espera um atendente` : "O Nexo Assist está atendendo"}
          </p>
          <p className="text-[12.5px] text-ink-3">
            {waiting ? waitingText(c, now) : "Você pode assumir se quiser intervir."}
          </p>
        </div>
        <ConversationActions
          id={c.id}
          actions={waiting ? ["return_to_agent", "assume"] : ["assume"]}
        />
      </div>
      <p className="flex h-11 items-center gap-2 rounded-[12px] bg-desk px-3.5 text-[14.5px] text-ink-3">
        <Lock className="size-4" aria-hidden />
        Assuma o atendimento para responder
      </p>
    </>
  );
}

function Notice({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex size-9 items-center justify-center rounded-full bg-desk text-ink-3">
        <Icon className="size-[17px]" aria-hidden />
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-[14.5px] font-semibold">{title}</p>
        {body && <p className="text-[12.5px] text-ink-3">{body}</p>}
      </div>
    </div>
  );
}

const SYSTEM_ICON: [RegExp, LucideIcon][] = [
  [/assumiu/, Headset],
  [/devolveu/, Bot],
  [/encerrado/i, CircleCheckBig],
];

function MessageItem({ message: m }: { message: MessageRow }) {
  const time = formatTime(m.createdAt.toISOString());

  if (m.author === "system") {
    const Icon = SYSTEM_ICON.find(([re]) => re.test(m.text))?.[1] ?? ArrowRightLeft;
    return (
      <li className="flex items-center gap-3 pt-[18px] pb-1">
        <span className="h-px flex-1 bg-ink/8" />
        <span className="flex items-center gap-1.5 text-center text-[12px] font-medium text-ink-3">
          <Icon className="size-[13px] shrink-0" aria-hidden />
          {m.text} · {time}
        </span>
        <span className="h-px flex-1 bg-ink/8" />
      </li>
    );
  }

  if (m.author === "employee") {
    return (
      <li className="flex flex-col items-start gap-1 pt-4">
        <Bubble className="rounded-[4px_12px_12px_12px] bg-paper" time={time} text={m.text} />
      </li>
    );
  }

  const isAgent = m.author === "agent";
  return (
    <li className="flex flex-col items-end gap-1 pt-4">
      <span className="flex items-center gap-1.5 px-1 text-[12px] font-semibold text-ink-2">
        {isAgent ? "Nexo Assist" : m.authorName}
        <span
          className={`rounded-sm px-1.5 py-px text-[11px] ${isAgent ? "bg-primary-soft text-primary-text" : "bg-success-soft text-success-text"}`}
        >
          {isAgent ? "IA" : (m.authorTeam ?? "Analista")}
        </span>
      </span>
      <Bubble
        className={`rounded-[12px_4px_12px_12px] ${isAgent ? "bg-[#E6EFFA]" : "bg-[#E3F4EA]"}`}
        time={time}
        text={m.text}
        ticks
      />
      {isAgent && m.steps && m.steps.length > 0 && (
        <span className="px-1 text-[11.5px] text-ink-3">
          {m.steps.map((s) => s.label).join(" · ")}
        </span>
      )}
    </li>
  );
}

function Bubble({
  className,
  text,
  time,
  ticks = false,
}: {
  className: string;
  text: string;
  time: string;
  ticks?: boolean;
}) {
  return (
    <div
      className={`flex max-w-[min(520px,90%)] flex-wrap items-end justify-end gap-x-2.5 gap-y-0.5 px-3 pt-2 pb-1.5 ${className}`}
    >
      <p className="text-[14.5px] leading-[1.45] break-words whitespace-pre-wrap">{text}</p>
      <span className="flex items-center gap-[3px] pb-px text-[11px] text-ink-3">
        {time}
        {ticks && <CheckCheck className="size-3.5 text-primary" aria-hidden />}
      </span>
    </div>
  );
}

function HandoffSummary({ conversation: c }: { conversation: ConversationRow }) {
  const reasons = (c.handoffReasons ?? []).map((r) => HANDOFF_REASON_LABEL[r]);
  return (
    <li className="mt-5 self-center">
      <div className="flex w-full max-w-[560px] flex-col gap-2 rounded-[12px] border border-violet/25 bg-paper px-4 py-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-violet-text">
          <Sparkles className="size-3.5" aria-hidden />
          Resumo do agent para o analista
          {c.agentConfidence !== null && (
            <span className="font-normal text-ink-3">
              · confiança {Math.round(c.agentConfidence * 100)}%
            </span>
          )}
        </p>
        <p className="text-[13.5px] leading-normal text-ink-2">{c.handoffSummary}</p>
        {reasons.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <li key={r} className="rounded-full bg-desk px-2 py-0.5 text-[11.5px] text-ink-3">
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
