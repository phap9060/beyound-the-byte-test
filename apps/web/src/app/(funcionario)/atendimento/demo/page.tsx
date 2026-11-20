import { computeDueAt, toTicketView } from "@nexo/domain";
import type { TicketDraft } from "@nexo/domain";
import type { Metadata } from "next";

import { StatusPill, TopBar } from "@/components/employee/top-bar";

import { DemoConversation } from "./demo-conversation";

export const metadata: Metadata = { title: "Demonstração · Nexo Assist" };

// Página temporária para revisar os componentes do chat antes de o agent existir (sai na Parte 7).

const DAY = 24 * 60 * 60 * 1000;

export default function DemoPage() {
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const base = { requesterId: "emp-ana", affected: "somente_eu" } as const;

  const tickets = [
    toTicketView(
      {
        ...base,
        id: "INC-20311",
        type: "INC",
        title: "Notebook lento após atualização do Windows",
        description:
          "Lentidão geral desde a última atualização do Windows. Reiniciar e rodar o diagnóstico da central não resolveu.",
        category: "hardware",
        subcategory: "Notebook",
        priority: "media",
        status: "aguardando_analista",
        createdAt: ago(6),
        lastSupportUpdateAt: ago(6),
      },
      now,
    ),
    toTicketView(
      {
        ...base,
        id: "INC-20298",
        type: "INC",
        title: "Acesso à pasta Financeiro no SharePoint",
        description: "Não consigo abrir a pasta Financeiro/Fechamento no SharePoint.",
        category: "acesso",
        priority: "media",
        status: "em_andamento",
        createdAt: ago(3),
        lastSupportUpdateAt: ago(1),
      },
      now,
    ),
    toTicketView(
      {
        ...base,
        id: "REQ-10442",
        type: "REQ",
        title: "Segundo monitor para home office",
        description: "Solicito um segundo monitor para o home office.",
        category: "hardware",
        priority: "baixa",
        status: "aprovado",
        createdAt: ago(7),
        lastSupportUpdateAt: ago(3),
      },
      now,
    ),
  ];

  const draft: TicketDraft = {
    type: "INC",
    title: "VPN não conecta no notebook — erro 809",
    description:
      "Desde ontem o notebook (Windows 11) não conecta na VPN e mostra o erro 809. Precisa dela para a reunião das 14h.",
    category: "rede_vpn",
    priority: "alta",
    affected: "somente_eu",
  };

  return (
    <>
      <TopBar title="Atendimento · demonstração">
        <StatusPill tone="success">Assistente online</StatusPill>
      </TopBar>
      <DemoConversation
        nowIso={now.toISOString()}
        tickets={tickets}
        draft={draft}
        draftDueAt={computeDueAt(now, "alta").toISOString()}
      />
    </>
  );
}
