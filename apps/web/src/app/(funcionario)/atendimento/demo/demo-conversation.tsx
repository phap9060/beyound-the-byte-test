"use client";

import type { QuickOption, TicketDraft, TicketView } from "@nexo/domain";
import { useState } from "react";

import { DraftCard } from "@/components/chat/draft-card";
import type { DraftState } from "@/components/chat/draft-card";
import { AgentBubble, AgentMessage, EmployeeMessage } from "@/components/chat/messages";
import { QuickOptions } from "@/components/chat/quick-options";
import { TicketCard } from "@/components/chat/ticket-card";
import { TicketSelector } from "@/components/chat/ticket-selector";
import { Composer } from "@/components/employee/composer";

const AFFECTED: QuickOption[] = [
  { value: "somente_eu", label: "Só eu" },
  { value: "equipe", label: "Minha equipe" },
  { value: "empresa", label: "Toda a empresa" },
  { value: "nao_sei", label: "Não sei" },
];

const NEXT_STEPS: QuickOption[] = [
  { value: "analista", label: "Falar com um analista" },
  { value: "informacao", label: "Adicionar informação" },
  { value: "nao", label: "Não, obrigado" },
];

interface Props {
  nowIso: string;
  tickets: TicketView[];
  draft: TicketDraft;
  draftDueAt: string;
}

export function DemoConversation({ nowIso, tickets, draft, draftDueAt }: Props) {
  const now = new Date(nowIso);
  const [affected, setAffected] = useState<QuickOption>();
  const [draftState, setDraftState] = useState<DraftState>("pending");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<TicketView>();
  const [nextStep, setNextStep] = useState<QuickOption>();

  function confirm() {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setDraftState("confirmed");
    }, 900);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section
        aria-label="Conversa"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-4 pt-7 pb-1 md:px-10"
      >
        <div className="mx-auto flex w-full max-w-[808px] flex-col gap-5 pb-6">
          <p className="rounded-lg bg-violet-soft px-3.5 py-2.5 text-[13px] text-violet-text">
            Demonstração dos componentes com dados de exemplo. As respostas são roteirizadas; o
            agent entra na Parte 7.
          </p>

          <EmployeeMessage text="Meu notebook não conecta na VPN desde ontem. Aparece o erro 809." />
          <AgentMessage
            steps={[
              { label: "consultou seus chamados", status: "done" },
              { label: "buscou na central de ajuda", status: "done" },
            ]}
          >
            <AgentBubble>
              <p>
                Não há chamado aberto sobre VPN, e o artigo do erro 809 vale só para Windows 10 — o
                seu é Windows 11. Vou abrir um chamado.
              </p>
              <QuickOptions
                question="Quem está sendo afetado?"
                numbered
                options={AFFECTED}
                selected={affected?.value}
                onSelect={setAffected}
              />
            </AgentBubble>
          </AgentMessage>

          {affected && (
            <>
              <EmployeeMessage text={affected.label} />
              <AgentMessage
                steps={[
                  { label: "classificou a prioridade", status: "done" },
                  { label: "consultou o SLA", status: "done" },
                  { label: "montou o rascunho", status: "done" },
                ]}
              >
                <AgentBubble>
                  <p>Coloquei prioridade alta por causa da reunião. Confira antes de eu criar:</p>
                </AgentBubble>
                <DraftCard
                  draftId="D-381"
                  draft={draft}
                  dueAt={draftDueAt}
                  state={draftState}
                  busy={busy}
                  {...(draftState === "confirmed" ? { ticketId: "INC-20336" } : {})}
                  onConfirm={confirm}
                  onEdit={() => undefined}
                  onCancel={() => {
                    setDraftState("cancelled");
                  }}
                />
              </AgentMessage>
            </>
          )}

          <hr className="my-4 border-rule" />

          <EmployeeMessage text="Qual o status do meu chamado?" />
          <AgentMessage steps={[{ label: "consultou seus chamados", status: "done" }]}>
            <AgentBubble>
              <p>Você tem {tickets.length} chamados abertos. Sobre qual deles quer saber?</p>
            </AgentBubble>
            <TicketSelector tickets={tickets} selectedId={selected?.id} onSelect={setSelected} />
          </AgentMessage>

          {selected && (
            <>
              <EmployeeMessage text={`${selected.id} · ${selected.title}`} />
              <AgentMessage
                steps={[
                  { label: `consultou o ${selected.id}`, status: "done" },
                  { label: "calculou o prazo", status: "done" },
                ]}
              >
                <TicketCard ticket={selected} now={now} />
                <AgentBubble>
                  <p>
                    {selected.sla.state === "vencido"
                      ? "Está acima do prazo para a prioridade dele. Quer que eu chame um analista?"
                      : "Está dentro do prazo. Quer fazer mais alguma coisa com ele?"}
                  </p>
                  <QuickOptions
                    numbered={false}
                    options={NEXT_STEPS}
                    selected={nextStep?.value}
                    onSelect={setNextStep}
                  />
                </AgentBubble>
              </AgentMessage>
              {nextStep && <EmployeeMessage text={nextStep.label} />}
            </>
          )}

          <AgentMessage
            steps={[
              { label: "consultou seus chamados", status: "done" },
              { label: "tentou abrir o chamado", status: "failed" },
            ]}
          >
            <AgentBubble>
              <p>Exemplo de passo com falha: o sistema de chamados estava fora do ar.</p>
            </AgentBubble>
          </AgentMessage>
        </div>
      </section>

      <div className="px-4 pt-2.5 pb-[18px] md:px-10">
        <div className="mx-auto w-full max-w-[808px]">
          <Composer used={4} disabledReason="Demonstração: o envio fica desligado." />
        </div>
      </div>
    </div>
  );
}
