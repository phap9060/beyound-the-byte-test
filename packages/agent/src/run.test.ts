import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { runAgentTurn } from "./run.ts";
import { ANA, NOW, TICKETS, ago, createFakeClient, ticket } from "./testing/fixtures.ts";

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

async function run(model: MockLanguageModelV4, message = "oi", tickets = TICKETS) {
  const { client, calls } = createFakeClient(tickets);
  const result = await runAgentTurn({
    model,
    client,
    employee: ANA,
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
        detail: "3 chamado(s) abertos, 1 vencido(s)",
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
      ...TICKETS,
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

  it("mostra o card do chamado citado no texto, mas só se uma ferramenta o trouxe", async () => {
    const { turn } = await run(
      scripted(
        call("consultar_meus_chamados", { situacao: "abertos" }),
        reply({ mensagem: "Você já tem o INC-20311 aberto. O INC-20335 não é seu." }),
      ),
    );

    expect(turn.parts).toHaveLength(1);
    expect(turn.parts[0]).toMatchObject({ type: "ticket_card", ticket: { id: "INC-20311" } });
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

  it("descarta só o campo opcional fora do formato e mantém a resposta", async () => {
    const { turn } = await run(
      scripted(
        reply({ mensagem: "Pode me dizer mais?", opcoes: { itens: ["Só uma"], numeradas: false } }),
      ),
    );

    expect(turn.text).toBe("Pode me dizer mais?");
    expect(turn.handoff).toBeUndefined();
    expect(turn.parts).toEqual([]);
    expect(turn.steps.at(-1)).toMatchObject({ label: "ajustou a resposta", status: "failed" });
  });

  it("cai na contingência quando falta o essencial e diz o porquê", async () => {
    const { turn } = await run(scripted(call("responder", { mensagem: "oi" })));

    expect(turn.decision.confidence).toBe(0);
    expect(turn.decision.reason).toContain("fora do formato esperado");
    expect(turn.handoff?.reasons).toEqual(["baixa_confianca"]);
  });

  it("devolve erro (sem lançar) quando o provedor do modelo falha", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: () => Promise.reject(new Error("quota exceeded")),
    });
    const { client } = createFakeClient(TICKETS);
    const result = await runAgentTurn({
      model,
      client,
      employee: ANA,
      history: [],
      message: "oi",
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, error: { kind: "model_error" } });
  });

  it("envia o histórico e as instruções com o nome do funcionário", async () => {
    const model = scripted(reply());
    const { client } = createFakeClient(TICKETS);
    await runAgentTurn({
      model,
      client,
      employee: ANA,
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
