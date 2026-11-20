import { err, ok } from "@nexo/domain";
import type { Category, Ticket, TicketSummary } from "@nexo/domain";
import type { ClientError, KbSearchResult, TicketStatusFilter } from "@nexo/ticket-client";

import type { AgentTicketClient } from "../tools.ts";

// Dados em memória para testes e evals: o mesmo cenário do seed do ticket-service,
// numa data fixa, para o resultado não depender do dia em que se roda.

// Quarta-feira, 14h em Brasília.
export const NOW = new Date("2026-11-18T17:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
export const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

export const ANA = { id: "emp-ana", name: "Ana Souza" };

export function ticket(partial: Partial<Ticket> & Pick<Ticket, "id" | "title">): Ticket {
  return {
    type: partial.id.startsWith("INC") ? "INC" : "REQ",
    description: "Descrição de teste do chamado.",
    category: "hardware",
    priority: "media",
    status: "aguardando_analista",
    affected: "somente_eu",
    requesterId: "emp-ana",
    createdAt: ago(10),
    lastSupportUpdateAt: ago(6),
    updates: [],
    ...partial,
  };
}

export const TICKETS: Ticket[] = [
  ticket({
    id: "INC-20311",
    title: "Notebook lento após atualização do Windows",
    description: "Lentidão geral desde a última atualização do Windows.",
    lastSupportUpdateAt: ago(6),
  }),
  ticket({
    id: "INC-20298",
    title: "Acesso à pasta Financeiro no SharePoint",
    category: "acesso",
    status: "em_andamento",
    lastSupportUpdateAt: ago(1),
  }),
  ticket({
    id: "REQ-10442",
    title: "Segundo monitor para home office",
    priority: "baixa",
    status: "aprovado",
    lastSupportUpdateAt: ago(3),
  }),
  ticket({
    id: "INC-20150",
    title: "Senha do SAP bloqueada",
    category: "acesso",
    status: "resolvido",
    resolvedAt: ago(4),
  }),
  ticket({
    id: "INC-19877",
    title: "Outlook não sincroniza no celular",
    category: "email",
    status: "resolvido",
    resolvedAt: ago(20),
  }),
  ticket({
    id: "INC-20335",
    title: "VPN cai a cada 10 minutos",
    category: "rede_vpn",
    priority: "alta",
    requesterId: "emp-bruno",
  }),
];

interface Article {
  id: string;
  title: string;
  body: string;
  category: Category;
  keywords: string;
}

export const ARTICLES: Article[] = [
  {
    id: "KB-001",
    title: "VPN com erro 809",
    body: "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
    category: "rede_vpn",
    keywords: "vpn,809,erro 809,conexão,windows 10,home office",
  },
  {
    id: "KB-002",
    title: "Horário do service desk",
    body: "O service desk atende de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
    category: "outros",
    keywords: "horário,atendimento,plantão,service desk,expediente",
  },
  {
    id: "KB-003",
    title: "Como redefinir a senha da rede",
    body: "Acesse senha.nexo.com.br, informe seu e-mail corporativo e siga o código enviado por SMS.",
    category: "acesso",
    keywords: "senha,rede,esqueci,expirada,redefinir,trocar senha",
  },
  {
    id: "KB-004",
    title: "Senha do SAP bloqueada",
    body: "O SAP bloqueia a senha após 3 tentativas erradas. O desbloqueio é automático depois de 30 minutos. Se precisar antes, abra um chamado.",
    category: "acesso",
    keywords: "sap,senha,bloqueada,bloqueio,tentativas",
  },
  {
    id: "KB-007",
    title: "Notebook lento após atualização do Windows",
    body: "Deixe o notebook ligado na tomada por 1 hora, reinicie e rode o diagnóstico do portal de softwares. Se a lentidão continuar, abra um chamado.",
    category: "hardware",
    keywords: "notebook,lento,lentidão,atualização,windows,desempenho",
  },
  {
    id: "KB-008",
    title: "Como solicitar a instalação de um software",
    body: "Softwares homologados podem ser instalados direto pelo portal de softwares. Para os demais, abra uma requisição informando o software e o motivo.",
    category: "software",
    keywords: "software,instalar,instalação,programa,licença,portal de softwares",
  },
];

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// Mesma ideia da busca do ticket-service: palavras com peso no título, nas palavras-chave e no texto.
function search(query: string, limit: number): KbSearchResult[] {
  const terms = [...new Set(normalize(query).split(/[^\p{L}\p{N}]+/u))].filter(
    (t) => t.length >= 3,
  );
  return ARTICLES.map((a) => {
    const score = terms.reduce(
      (sum, t) =>
        sum +
        (normalize(a.title).includes(t) ? 3 : 0) +
        (normalize(a.keywords).includes(t) ? 2 : 0) +
        (normalize(a.body).includes(t) ? 1 : 0),
      0,
    );
    return { id: a.id, title: a.title, body: a.body, category: a.category, score };
  })
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

const notFound: ClientError = { kind: "service", status: 404, code: "not_found", message: "x" };
const OPEN = new Set(["aguardando_analista", "em_andamento", "aprovado"]);

export interface ClientCall {
  method: string;
  employeeId?: string;
  args: unknown[];
}

export function createFakeClient(tickets: Ticket[] = TICKETS) {
  const calls: ClientCall[] = [];
  const isOpen = (t: TicketSummary) => OPEN.has(t.status);
  const filter = (t: TicketSummary, status: TicketStatusFilter) =>
    status === "all" || (status === "open") === isOpen(t);

  const client: AgentTicketClient = {
    listTickets: (employeeId, status) => {
      calls.push({ method: "listTickets", employeeId, args: [status] });
      return Promise.resolve(
        ok(tickets.filter((t) => t.requesterId === employeeId && filter(t, status ?? "all"))),
      );
    },
    getTicket: (employeeId, ticketId) => {
      calls.push({ method: "getTicket", employeeId, args: [ticketId] });
      const found = tickets.find((t) => t.id === ticketId && t.requesterId === employeeId);
      return Promise.resolve(found ? ok(found) : err(notFound));
    },
    searchKb: (query, limit) => {
      calls.push({ method: "searchKb", args: [query] });
      return Promise.resolve(ok(search(query, limit ?? 3)));
    },
    transferTicket: (employeeId, ticketId, transfer) => {
      calls.push({ method: "transferTicket", employeeId, args: [ticketId, transfer] });
      const found = tickets.find((t) => t.id === ticketId && t.requesterId === employeeId);
      return Promise.resolve(found ? ok(found) : err(notFound));
    },
  };
  return { client, calls };
}
