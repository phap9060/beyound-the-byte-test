import { handoffDeadline } from "@nexo/domain";
import type { AgentStep } from "@nexo/domain";
import { count } from "drizzle-orm";

import type { Database } from "./client";
import { conversations, messages } from "./schema";

type NewConversation = typeof conversations.$inferInsert;
type NewMessage = typeof messages.$inferInsert;

const MIN = 60 * 1000;
const done = (...labels: string[]): AgentStep[] =>
  labels.map((label) => ({ label, status: "done" }));

// Conversas de outros funcionários para o console não começar vazio. A Ana fica de fora de propósito:
// é com ela que se testa o chat, e uma conversa transferida deixaria o agent dela pausado.
export function buildConversationSeed(now: Date) {
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * MIN);
  const convs: NewConversation[] = [];
  const msgs: NewMessage[] = [];

  function conversation(
    c: Omit<NewConversation, "createdAt" | "updatedAt" | "lastMessageAt">,
    lines: [number, Omit<NewMessage, "conversationId" | "createdAt">][],
  ) {
    const times = lines.map(([m]) => at(m));
    const first = times[0] ?? now;
    const last = times[times.length - 1] ?? now;
    convs.push({ ...c, createdAt: first, updatedAt: last, lastMessageAt: last });
    for (const [m, line] of lines) msgs.push({ ...line, conversationId: c.id, createdAt: at(m) });
  }

  const handedCarla = at(35);
  conversation(
    {
      id: "conv-carla",
      employeeId: "emp-carla",
      employeeName: "Carla Mendes",
      employeeEmail: "carla.mendes@nexo.com.br",
      employeeDepartment: "Comercial",
      status: "waiting_human",
      linkedTicketId: "REQ-10460",
      handoffReasons: ["pedido_do_funcionario"],
      handoffTeam: "Suporte N1",
      handoffSummary:
        "Carla precisa de acesso ao módulo SD do SAP ainda hoje para lançar pedidos de um cliente. REQ-10460 aberto há 2 h, prioridade alta, dentro do prazo. Pediu para falar com uma pessoa.",
      agentConfidence: 0.92,
      handedOffAt: handedCarla,
      waitingUntil: handoffDeadline(handedCarla, "alta"),
    },
    [
      [40, { author: "employee", text: "Preciso de acesso ao SAP ainda hoje" }],
      [
        39,
        {
          author: "agent",
          text: "Encontrei seu pedido REQ-10460, aguardando análise, com prioridade alta. Ele ainda está dentro do prazo de 4 horas úteis.",
          steps: done("consultou seus chamados", "calculou o prazo"),
        },
      ],
      [36, { author: "employee", text: "Tenho cliente esperando. Quero falar com alguém agora." }],
      [
        35,
        {
          author: "agent",
          text: "Entendi. Encaminhei para o Suporte N1, que fala com você em até 2 horas úteis.",
          steps: done("transferiu para um analista"),
        },
      ],
      [35, { author: "system", text: "Transferida para Suporte N1" }],
    ],
  );

  const handedBruno = at(14);
  conversation(
    {
      id: "conv-bruno",
      employeeId: "emp-bruno",
      employeeName: "Bruno Tavares",
      employeeEmail: "bruno.tavares@nexo.com.br",
      employeeDepartment: "Logística",
      status: "waiting_human",
      linkedTicketId: "INC-20335",
      handoffReasons: ["baixa_confianca"],
      handoffTeam: "Suporte N1",
      handoffSummary:
        "Bruno relata que, além da VPN caindo (INC-20335), o Teams parou de abrir. Não ficou claro se é um problema novo ou o mesmo; o agent não teve segurança para decidir entre atualizar o chamado ou abrir outro.",
      agentConfidence: 0.41,
      handedOffAt: handedBruno,
      waitingUntil: handoffDeadline(handedBruno),
    },
    [
      [
        16,
        {
          author: "employee",
          text: "A VPN caiu de novo e agora o Teams também não abre. Será que é o notebook?",
        },
      ],
      [
        14,
        {
          author: "agent",
          text: "Não tenho segurança para dizer se é o mesmo problema da VPN ou algo novo no notebook. Vou chamar um analista para isso.",
          steps: done("consultou seus chamados", "buscou na central de ajuda"),
        },
      ],
      [14, { author: "system", text: "Transferida para Suporte N1" }],
    ],
  );

  conversation(
    {
      id: "conv-diego",
      employeeId: "emp-diego",
      employeeName: "Diego Ramos",
      employeeEmail: "diego.ramos@nexo.com.br",
      employeeDepartment: "Marketing",
      status: "agent",
      linkedTicketId: "REQ-10455",
    },
    [
      [3, { author: "employee", text: "Como instalo o Figma?" }],
      [
        2,
        {
          author: "agent",
          text: "O Figma não está no portal de softwares, então precisa de uma requisição com aprovação do gestor. Você já tem o REQ-10455 aberto, aguardando análise e dentro do prazo.",
          steps: done("buscou na central de ajuda", "consultou seus chamados"),
        },
      ],
    ],
  );

  conversation(
    {
      id: "conv-elisa",
      employeeId: "emp-elisa",
      employeeName: "Elisa Prado",
      employeeEmail: "elisa.prado@nexo.com.br",
      employeeDepartment: "Recursos Humanos",
      status: "closed",
      closedBy: "agent",
      closedAt: at(50),
    },
    [
      [55, { author: "employee", text: "Qual o horário do service desk?" }],
      [
        55,
        {
          author: "agent",
          text: "De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
          steps: done("buscou na central de ajuda"),
        },
      ],
      [51, { author: "employee", text: "Isso resolveu, obrigado!" }],
    ],
  );

  conversation(
    {
      id: "conv-fabio",
      employeeId: "emp-fabio",
      employeeName: "Fábio Nunes",
      employeeEmail: "fabio.nunes@nexo.com.br",
      employeeDepartment: "Jurídico",
      status: "closed",
      closedBy: "agent",
      closedAt: at(24 * 60),
    },
    [
      [24 * 60 + 4, { author: "employee", text: "Qual a senha do Wi-Fi para visitantes?" }],
      [
        24 * 60 + 3,
        {
          author: "agent",
          text: "A rede é a Nexo-Visitante. A senha muda toda segunda-feira e fica com a recepção do seu andar.",
          steps: done("buscou na central de ajuda"),
        },
      ],
    ],
  );

  return { conversations: convs, messages: msgs };
}

export async function seedConversationsIfEmpty(db: Database, now = new Date()): Promise<boolean> {
  const [row] = await db.select({ total: count() }).from(conversations);
  if (row && row.total > 0) return false;

  const data = buildConversationSeed(now);
  await db.transaction(async (tx) => {
    await tx.insert(conversations).values(data.conversations);
    await tx.insert(messages).values(data.messages);
  });
  return true;
}
