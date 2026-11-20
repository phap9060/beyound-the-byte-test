"use client";

import type { MessagePart } from "@nexo/domain";
import { useEffect, useRef, useState } from "react";

import {
  resolveProposalAction,
  sendEmployeeMessage,
} from "@/app/(funcionario)/atendimento/actions";
import { DraftCard } from "@/components/chat/draft-card";
import {
  AgentBubble,
  AgentMessage,
  AnalystMessage,
  EmployeeMessage,
  SystemLine,
} from "@/components/chat/messages";
import { QuickOptions } from "@/components/chat/quick-options";
import { TicketCard } from "@/components/chat/ticket-card";
import { TicketSelector } from "@/components/chat/ticket-selector";
import { UpdateDraftCard } from "@/components/chat/update-draft-card";
import type { ChatMessage, ConversationState } from "@/lib/chat-types";
import { formatTime } from "@/lib/format";

import { Composer } from "./composer";
import type { ComposerHandle } from "./composer";
import { StatusPill, TopBar } from "./top-bar";

interface Props {
  conversationId: string;
  firstName: string;
  initialMessages: ChatMessage[];
  initialState: ConversationState;
  initialUsed: number;
}

function upsert(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === message.id)) {
    return list.map((m) => (m.id === message.id ? message : m));
  }
  return [...list, message].sort((a, b) => a.id - b.id);
}

type Choice = "confirm" | "cancel";

interface ProposalHandlers {
  // Só o rascunho pendente mais recente aceita ação; os anteriores ficaram para trás na conversa.
  activeDraft: string | undefined;
  busyDraft: string | undefined;
  onResolve: (messageId: number, draftId: string, choice: Choice) => void;
  onEdit: () => void;
}

export function EmployeeChat(props: Props) {
  const { conversationId, firstName, initialMessages, initialState, initialUsed } = props;
  const [messages, setMessages] = useState(initialMessages);
  const [state, setState] = useState(initialState);
  const [used, setUsed] = useState(initialUsed);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(true);
  const [working, setWorking] = useState(false);
  const [busyDraft, setBusyDraft] = useState<string>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const firstId = useRef(initialMessages.at(-1)?.id ?? 0);

  useEffect(() => {
    const source = new EventSource(
      `/api/conversations/${conversationId}/events?after=${String(firstId.current)}`,
    );
    source.addEventListener("message", (e) => {
      const data = JSON.parse(String(e.data)) as { message: ChatMessage };
      setMessages((list) => upsert(list, data.message));
    });
    source.addEventListener("message_updated", (e) => {
      const data = JSON.parse(String(e.data)) as { message: ChatMessage };
      setMessages((list) => upsert(list, data.message));
    });
    source.addEventListener("agent", (e) => {
      const data = JSON.parse(String(e.data)) as { working: boolean };
      setWorking(data.working);
    });
    source.addEventListener("state", (e) => {
      const data = JSON.parse(String(e.data)) as { state: ConversationState };
      setState(data.state);
    });
    source.addEventListener("open", () => {
      setConnected(true);
    });
    source.addEventListener("error", () => {
      setConnected(false);
    });
    return () => {
      source.close();
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, working]);

  async function send(text: string) {
    setSending(true);
    setError(undefined);
    const result = await sendEmployeeMessage(text);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUsed((n) => n + 1);
    setMessages((list) => upsert(list, result.message));
  }

  async function resolve(messageId: number, draftId: string, choice: Choice) {
    setBusyDraft(draftId);
    setError(undefined);
    const result = await resolveProposalAction({ messageId, draftId, choice });
    setBusyDraft(undefined);
    if (!result.ok) setError(result.error);
  }

  const activeDraft = messages
    .flatMap((m) => m.parts)
    .findLast((p) => (p.type === "draft" || p.type === "update_draft") && p.state === "pending");

  const proposals: ProposalHandlers = {
    activeDraft:
      activeDraft?.type === "draft" || activeDraft?.type === "update_draft"
        ? activeDraft.draftId
        : undefined,
    busyDraft,
    onResolve: (messageId, draftId, choice) => void resolve(messageId, draftId, choice),
    onEdit: () => composerRef.current?.fill("Quero ajustar o rascunho: "),
  };

  const lastId = messages.at(-1)?.id;
  const agentActive = state.status === "agent";

  return (
    <>
      <TopBar title="Atendimento">
        <HeaderStatus state={state} />
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col">
        <section
          aria-label="Conversa"
          aria-live="polite"
          className="flex flex-1 flex-col overflow-y-auto px-4 pt-7 pb-1 md:px-10"
        >
          <div className="mx-auto mt-auto flex w-full max-w-[808px] flex-col gap-5 pb-6">
            {messages.length === 0 && <Greeting firstName={firstName} />}
            {messages.map((m, i) => (
              <MessageView
                key={m.id}
                message={m}
                answer={messages.slice(i + 1).find((n) => n.author === "employee")?.text}
                interactive={m.id === lastId && agentActive && !sending && !working}
                onAnswer={(text) => void send(text)}
                proposals={proposals}
              />
            ))}
            {working && agentActive && <Thinking />}
            <StateBanner state={state} />
            <div ref={bottomRef} />
          </div>
        </section>

        <div className="px-4 pt-2.5 pb-[18px] md:px-10">
          <div className="mx-auto flex w-full max-w-[808px] flex-col gap-1.5">
            {(error ?? !connected) && (
              <p role="alert" className="text-[12.5px] text-danger-text">
                {error ?? "Conexão perdida. Tentando reconectar…"}
              </p>
            )}
            <Composer
              ref={composerRef}
              used={used}
              onSend={(text) => void send(text)}
              disabledReason={sending ? "Enviando…" : undefined}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Greeting({ firstName }: { firstName: string }) {
  return (
    <div>
      <h1 className="font-display text-[28px] leading-tight tracking-[-0.4px] md:text-[34px]">
        Olá, {firstName}. Como posso ajudar?
      </h1>
      <p className="mt-2 max-w-[560px] text-[14.5px] leading-normal text-ink-3">
        Descreva o problema com suas palavras. Eu consulto seus chamados, busco na central de ajuda
        e chamo um analista quando precisar.
      </p>
    </div>
  );
}

function HeaderStatus({ state }: { state: ConversationState }) {
  switch (state.status) {
    case "agent":
    case "closed":
      return <StatusPill tone="success">Assistente online</StatusPill>;
    case "waiting_human":
      return <StatusPill tone="warning">Aguardando analista</StatusPill>;
    case "human":
      return <StatusPill tone="success">Com {state.analystName ?? "um analista"}</StatusPill>;
  }
}

function StateBanner({ state }: { state: ConversationState }) {
  if (state.status === "waiting_human") {
    const until = state.waitingUntil ? ` até ${formatTime(state.waitingUntil)}` : " em breve";
    return (
      <p className="rounded-lg bg-warning-soft px-3.5 py-2.5 text-[13.5px] text-warning-text">
        Um analista vai falar com você{until}. Enquanto isso, o assistente fica pausado; pode
        escrever o que quiser acrescentar.
      </p>
    );
  }
  if (state.status === "closed") {
    return (
      <p className="rounded-lg bg-desk px-3.5 py-2.5 text-[13.5px] text-ink-3">
        Atendimento encerrado. Se precisar de mais alguma coisa, é só escrever.
      </p>
    );
  }
  return null;
}

function Thinking() {
  return (
    <AgentMessage steps={[]}>
      <p role="status" className="flex items-center gap-2 text-[13.5px] text-ink-3">
        <span className="flex gap-1" aria-hidden>
          <span className="size-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-ink-3" />
        </span>
        Analisando sua mensagem…
      </p>
    </AgentMessage>
  );
}

interface MessageViewProps {
  message: ChatMessage;
  answer: string | undefined;
  interactive: boolean;
  onAnswer: (text: string) => void;
  proposals: ProposalHandlers;
}

function MessageView({ message: m, answer, interactive, onAnswer, proposals }: MessageViewProps) {
  switch (m.author) {
    case "employee":
      return <EmployeeMessage text={m.text} />;
    case "system":
      return <SystemLine text={`${m.text} · ${formatTime(m.createdAt)}`} />;
    case "analyst":
      return <AnalystMessage name={m.authorName ?? "Analista"} team={m.authorTeam} text={m.text} />;
    case "agent":
      return (
        <AgentMessage steps={m.steps} trace={m.trace}>
          {m.text && (
            <AgentBubble>
              <p className="whitespace-pre-wrap">{m.text}</p>
            </AgentBubble>
          )}
          {m.parts.map((part, i) => (
            <PartView
              key={i}
              messageId={m.id}
              part={part}
              answer={answer}
              interactive={interactive}
              onAnswer={onAnswer}
              proposals={proposals}
            />
          ))}
        </AgentMessage>
      );
  }
}

function proposalActions(proposals: ProposalHandlers, messageId: number, draftId: string) {
  if (proposals.activeDraft !== draftId) return { busy: false };
  return {
    busy: proposals.busyDraft === draftId,
    onConfirm: () => {
      proposals.onResolve(messageId, draftId, "confirm");
    },
    onCancel: () => {
      proposals.onResolve(messageId, draftId, "cancel");
    },
  };
}

function PartView({
  messageId,
  part,
  answer,
  interactive,
  onAnswer,
  proposals,
}: {
  messageId: number;
  part: MessagePart;
  answer: string | undefined;
  interactive: boolean;
  onAnswer: (text: string) => void;
  proposals: ProposalHandlers;
}) {
  const now = new Date();
  switch (part.type) {
    case "text":
      return (
        <AgentBubble>
          <p className="whitespace-pre-wrap">{part.text}</p>
        </AgentBubble>
      );
    case "quick_options":
      return (
        <AgentBubble>
          <QuickOptions
            question={part.question}
            numbered={part.numbered}
            options={part.options}
            selected={part.options.find((o) => o.label === answer)?.value}
            onSelect={
              interactive
                ? (o) => {
                    onAnswer(o.label);
                  }
                : undefined
            }
          />
        </AgentBubble>
      );
    case "ticket_list":
      return (
        <TicketSelector
          tickets={part.tickets}
          selectedId={part.tickets.find((t) => answer?.startsWith(t.id))?.id}
          onSelect={
            interactive
              ? (t) => {
                  onAnswer(`${t.id} · ${t.title}`);
                }
              : undefined
          }
        />
      );
    case "ticket_card":
      return <TicketCard ticket={part.ticket} now={now} />;
    case "draft":
      return (
        <DraftCard
          draftId={part.draftId}
          draft={part.draft}
          dueAt={part.dueAt}
          state={part.state}
          ticketId={part.ticketId}
          {...proposalActions(proposals, messageId, part.draftId)}
          onEdit={proposals.activeDraft === part.draftId ? proposals.onEdit : undefined}
        />
      );
    case "update_draft":
      return (
        <UpdateDraftCard part={part} {...proposalActions(proposals, messageId, part.draftId)} />
      );
  }
}
