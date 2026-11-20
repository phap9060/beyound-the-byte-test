import { err, ok } from "@nexo/domain";
import type { Ticket, TicketSummary } from "@nexo/domain";
import type { ClientError } from "@nexo/ticket-client";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { runAgentTurn } from "./run.ts";
import type { AgentTicketClient } from "./tools.ts";

// Quarta-feira, 14h em Brasília.
const NOW = new Date("2026-11-18T17:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};

function call(toolName: string, input: unknown) {
  return {
    content: [
      {
        type: "tool-call" as const,
        toolCallId: crypto.randomUUID(),
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage,
    warnings: [],
  };
}

function scripted(...steps: ReturnType<typeof call>[]) {
  return new MockLanguageModelV4({ doGenerate: steps });
}

function reply(overrides: Record<string, unknown> = {}) {
  return call("responder", {
    mensagem: "Pronto.",
    intencao: "consultar_chamado",
    entendimento: "Quer saber dos chamados.",
    confianca: 0.9,
    motivo: "Consulta simples.",
    ...overrides,
  });
}

function ticket(partial: Partial<Ticket> & Pick<Ticket, "id" | "title">): Ticket {
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

const notFound: ClientError = { kind: "service", status: 404, code: "not_found", message: "x" };

function fakeClient(tickets: Ticket[]) {
  const calls: { method: string; employeeId?: string; args: unknown[] }[] = [];
  const client: AgentTicketClient = {
    listTickets: (employeeId, status) => {
      calls.push({ method: "listTickets", employeeId, args: [status] });
      const mine = tickets.filter((t) => t.requesterId === employeeId);
      const open = (t: TicketSummary) =>
        ["aguardando_analista", "em_andamento", "aprovado"].includes(t.status);
      const filtered =
        status === "all" ? mine : mine.filter((t) => (status === "open") === open(t));
      return Promise.resolve(ok(filtered));
    },
    getTicket: (employeeId, ticketId) => {
      calls.push({ method: "getTicket", employeeId, args: [ticketId] });
      const found = tickets.find((t) => t.id === ticketId && t.requesterId === employeeId);
      return Promise.resolve(found ? ok(found) : err(notFound));
    },
    searchKb: (query) => {
      calls.push({ method: "searchKb", args: [query] });
      return Promise.resolve(
        ok([
          {
            id: "kb-1",
            title: "VPN com erro 809",
            body: "Reinstale o cliente.",
            category: "rede_vpn" as const,
            score: 3,
          },
        ]),
      );
    },
    transferTicket: (employeeId, ticketId, transfer) => {
      calls.push({ method: "transferTicket", employeeId, args: [ticketId, transfer] });
      const found = tickets.find((t) => t.id === ticketId);
      return Promise.resolve(found ? ok(found) : err(notFound));
    },
  };
  return { client, calls };
}

const SEED = [
  ticket({ id: "INC-20311", title: "Notebook lento após atualização" }),
  ticket({
    id: "REQ-10442",
    title: "Segundo monitor",
    status: "aprovado",
    priority: "baixa",
    lastSupportUpdateAt: ago(1),
  }),
  ticket({
    id: "INC-20150",
    title: "Senha do SAP bloqueada",
    category: "acesso",
    status: "resolvido",
    resolvedAt: ago(4),
  }),
  ticket({ id: "INC-19877", title: "Teclado falhando", status: "resolvido", resolvedAt: ago(20) }),
  ticket({
    id: "INC-20335",
    title: "VPN do Bruno",
    requesterId: "emp-bruno",
    category: "rede_vpn",
  }),
];

const ana = { id: "emp-ana", name: "Ana Souza" };

async function run(model: MockLanguageModelV4, message = "oi", tickets = SEED) {
  const { client, calls } = fakeClient(tickets);
  const result = await runAgentTurn({
    model,
    client,
    employee: ana,
    history: [],
    message,
    now: NOW,
  });
  if (!result.ok) throw new Error(result.error.message);
  return { turn: result.value, calls, model };
}

describe("runAgentTurn", () => {
  it("consulta os chamados e mostra os escolhidos pelo modelo como lista", async () => {
    const { turn } = await run(
      scripted(
        call("consultar_meus_chamados", { situacao: "abertos" }),
        reply({ mostrarChamados: ["INC-20311", "REQ-10442"] }),
      ),
    );

    expect(turn.steps).toEqual([
      {
        label: "consultou seus chamados",
        status: "done",
        detail: "2 chamado(s) abertos, 1 vencido(s)",
      },
    ]);
    expect(turn.parts).toHaveLength(1);
    const [list] = turn.parts;
    expect(list?.type === "ticket_list" && list.tickets.map((t) => t.id)).toEqual([
      "INC-20311",
      "REQ-10442",
    ]);
    expect(turn.decision).toMatchObject({
      intent: "consultar_chamado",
      confidence: 0.9,
      action: "Mostrou os chamados para escolher",
    });
    expect(turn.handoff).toBeUndefined();
    expect(turn.usage).toEqual({ inputTokens: 200, outputTokens: 40, modelCalls: 2 });
  });

  it("usa sempre o funcionário da sessão e não mostra chamado que as ferramentas não trouxeram", async () => {
    const { turn, calls } = await run(
      scripted(
        call("ver_chamado", { ticketId: "INC-20335" }),
        reply({
          mostrarChamados: ["INC-20335"],
          mensagem: "Não encontrei esse chamado entre os seus.",
        }),
      ),
    );

    expect(calls).toEqual([{ method: "getTicket", employeeId: "emp-ana", args: ["INC-20335"] }]);
    expect(turn.steps[0]).toMatchObject({
      status: "failed",
      detail: "Chamado não encontrado entre os chamados deste funcionário.",
    });
    expect(turn.parts).toEqual([]);
  });

  it("calcula a prioridade pela regra do domínio e mostra o rascunho sem criar o chamado", async () => {
    const { turn, calls } = await run(
      scripted(
        call("preparar_rascunho", {
          tipo: "INC",
          titulo: "Outlook não abre",
          descricao: "O Outlook fecha sozinho ao abrir desde hoje cedo.",
          categoria: "email",
          afetados: "somente_eu",
          impedeTrabalho: true,
          compromissoHoje: false,
        }),
        reply({ intencao: "abrir_chamado" }),
      ),
    );

    expect(turn.priority).toMatchObject({ priority: "alta", rule: "impede_trabalho" });
    expect(turn.steps.map((s) => s.label)).toEqual([
      "classificou a prioridade",
      "preparou o rascunho",
    ]);
    const [draft] = turn.parts;
    expect(draft).toMatchObject({
      type: "draft",
      state: "pending",
      draft: { priority: "alta", category: "email" },
    });
    // 4 horas úteis a partir de quarta 14h.
    expect(draft?.type === "draft" && draft.dueAt).toBe("2026-11-18T21:00:00.000Z");
    expect(turn.decision.action).toBe("Mostrou um rascunho de chamado para confirmação");
    expect(calls.map((c) => c.method)).toEqual(["listTickets"]);
  });

  it("avisa sobre possível duplicidade antes de montar o rascunho", async () => {
    const { turn } = await run(
      scripted(
        call("preparar_rascunho", {
          tipo: "INC",
          titulo: "Notebook travando",
          descricao: "O notebook trava ao abrir o navegador.",
          categoria: "hardware",
          afetados: "somente_eu",
          impedeTrabalho: false,
          compromissoHoje: false,
        }),
        reply({ intencao: "abrir_chamado", mostrarChamados: ["INC-20311"] }),
      ),
    );

    expect(turn.parts.map((p) => p.type)).toEqual(["ticket_card"]);
    expect(turn.steps.at(-1)).toMatchObject({
      label: "procurou chamados parecidos",
      detail: "INC-20311",
    });
  });

  it("só ignora os parecidos que o modelo dispensou explicitamente", async () => {
    const draftInput = {
      tipo: "INC",
      titulo: "Mouse sem fio parou",
      descricao: "O mouse sem fio não responde nem com pilha nova.",
      categoria: "hardware",
      afetados: "somente_eu",
      impedeTrabalho: false,
      compromissoHoje: false,
    };
    const tickets = [
      ...SEED,
      ticket({ id: "INC-20400", title: "Monitor piscando", lastSupportUpdateAt: ago(0) }),
    ];

    const partial = await run(
      scripted(
        call("preparar_rascunho", { ...draftInput, chamadosDiferentes: ["INC-20311"] }),
        reply({ intencao: "abrir_chamado" }),
      ),
      "oi",
      tickets,
    );
    expect(partial.turn.parts).toEqual([]);
    expect(partial.turn.steps.at(-1)?.detail).toBe("INC-20311 (outro problema), INC-20400");

    const all = await run(
      scripted(
        call("preparar_rascunho", {
          ...draftInput,
          chamadosDiferentes: ["INC-20311", "INC-20400"],
        }),
        reply({ intencao: "abrir_chamado" }),
      ),
      "oi",
      tickets,
    );
    expect(all.turn.parts.map((p) => p.type)).toEqual(["draft"]);
  });

  it("não prepara reabertura fora da janela de 7 dias", async () => {
    const { turn } = await run(
      scripted(
        call("preparar_reabertura", {
          ticketId: "INC-19877",
          motivo: "O teclado voltou a falhar.",
        }),
        reply(),
      ),
    );

    expect(turn.parts).toEqual([]);
    expect(turn.steps[0]?.detail).toContain("Resolvido há mais de 7 dias");
  });

  it("prepara reabertura dentro da janela", async () => {
    const { turn } = await run(
      scripted(
        call("preparar_reabertura", { ticketId: "INC-20150", motivo: "A senha bloqueou de novo." }),
        reply(),
      ),
    );

    expect(turn.parts[0]).toMatchObject({
      type: "update_draft",
      action: "reabrir",
      ticketId: "INC-20150",
      state: "pending",
    });
  });

  it("transfere com resumo e encaminha o chamado vencido para o N2", async () => {
    const { turn, calls } = await run(
      scripted(
        call("transferir_para_analista", {
          motivo: "chamado_vencido",
          resumo: "Notebook lento há 6 dias sem retorno; funcionário pediu ajuda.",
          ticketId: "INC-20311",
        }),
        reply({
          intencao: "falar_com_analista",
          opcoes: { itens: ["Sim", "Não"], numeradas: false },
        }),
      ),
    );

    expect(turn.handoff).toEqual({
      reasons: ["pedido_do_funcionario", "chamado_vencido"],
      summary: "Notebook lento há 6 dias sem retorno; funcionário pediu ajuda.",
      ticketId: "INC-20311",
    });
    expect(calls.at(-1)).toMatchObject({
      method: "transferTicket",
      args: ["INC-20311", { team: "Suporte N2" }],
    });
    // Com a conversa indo para um analista, não faz sentido oferecer opções do agent.
    expect(turn.parts).toEqual([]);
  });

  it("transfere sozinho quando a confiança fica abaixo do limite", async () => {
    const { turn } = await run(scripted(reply({ intencao: "conversa", confianca: 0.3 })));

    expect(turn.handoff?.reasons).toEqual(["baixa_confianca"]);
    expect(turn.steps.at(-1)?.label).toBe("transferiu para um analista");
    expect(turn.text).toContain("chamei um analista");
  });

  it("cai num fallback seguro quando o modelo não chama responder", async () => {
    const steps = Array.from({ length: 6 }, () =>
      call("buscar_central_de_ajuda", { consulta: "vpn" }),
    );
    const { turn } = await run(scripted(...steps));

    expect(turn.decision.confidence).toBe(0);
    expect(turn.decision.reason).toContain("não concluiu");
    expect(turn.handoff?.reasons).toEqual(["baixa_confianca"]);
  });

  it("devolve erro (sem lançar) quando o provedor do modelo falha", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: () => Promise.reject(new Error("quota exceeded")),
    });
    const { client } = fakeClient(SEED);
    const result = await runAgentTurn({
      model,
      client,
      employee: ana,
      history: [],
      message: "oi",
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, error: { kind: "model_error" } });
  });

  it("envia o histórico e as instruções com o nome do funcionário", async () => {
    const model = scripted(reply());
    const { client } = fakeClient(SEED);
    await runAgentTurn({
      model,
      client,
      employee: ana,
      now: NOW,
      message: "e agora?",
      history: [
        { author: "agent", authorName: null, text: "Olá!", parts: [], steps: [] },
        { author: "employee", authorName: null, text: "minha VPN caiu", parts: [], steps: [] },
        {
          author: "agent",
          authorName: null,
          text: "Entendi.",
          parts: [],
          steps: [
            { label: "buscou na central de ajuda", status: "done", detail: "VPN com erro 809" },
          ],
        },
      ],
    });

    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Ana Souza");
    expect(prompt).toContain("minha VPN caiu");
    expect(prompt).not.toContain("Olá!");
    expect(prompt).toContain("[Ações: buscou na central de ajuda (VPN com erro 809)]");
    expect(model.doGenerateCalls[0]?.toolChoice).toEqual({ type: "required" });
  });
});
