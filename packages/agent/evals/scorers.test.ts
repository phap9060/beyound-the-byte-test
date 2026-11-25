import { describe, expect, it } from "vitest";

import type { AgentTurn } from "../src/run.ts";
import { RULES, scorers } from "./scorers.ts";
import { SCENARIOS } from "./scenarios.ts";
import type { EvalRun, Expected } from "./scenarios.ts";

const TURN: AgentTurn = {
  text: "Pronto.",
  parts: [],
  steps: [],
  toolCalls: [],
  decision: {
    intent: "duvida",
    understood: "Dúvida de VPN",
    action: "Respondeu",
    confidence: 0.9,
    reason: "Há um artigo.",
  },
  usage: { inputTokens: 0, outputTokens: 0, modelCalls: 1 },
  durationMs: 0,
};

const run = (turn: Partial<AgentTurn> = {}, calls: EvalRun["calls"] = []): EvalRun => ({
  turns: [{ ...TURN, ...turn }],
  calls,
});

const draft = (priority: "alta" | "critica"): AgentTurn["parts"][number] => ({
  type: "draft",
  draftId: "d1",
  dueAt: "2026-11-18T21:00:00.000Z",
  state: "pending",
  draft: {
    type: "INC",
    title: "Outlook não abre",
    description: "O Outlook fecha sozinho.",
    category: "email",
    priority,
    affected: "somente_eu",
  },
});

const reopen: AgentTurn["parts"][number] = {
  type: "update_draft",
  draftId: "d2",
  action: "reabrir",
  ticketId: "INC-20150",
  ticketTitle: "Senha do SAP bloqueada",
  message: "Voltou a bloquear.",
  state: "pending",
};

const handedOff = { handoff: { reasons: ["baixa_confianca" as const], summary: "x" } };

type Case = [keyof typeof RULES, string, EvalRun, Expected, boolean];

const CASES: Case[] = [
  ["intencao", "certa", run(), { intent: ["duvida"] }, true],
  ["intencao", "errada", run(), { intent: ["conversa"] }, false],
  [
    "consultas",
    "consultou",
    run({}, [{ method: "searchKb", args: [] }]),
    { called: ["searchKb"] },
    true,
  ],
  ["consultas", "não consultou", run(), { called: ["searchKb"] }, false],
  [
    "rascunho",
    "certo",
    run({ parts: [draft("alta")] }),
    { draft: { type: "INC", priority: "alta" } },
    true,
  ],
  [
    "rascunho",
    "prioridade errada",
    run({ parts: [draft("critica")] }),
    { draft: { priority: "alta" } },
    false,
  ],
  ["rascunho", "faltou", run(), { draft: { priority: "alta" } }, false],
  ["rascunho", "não devia", run({ parts: [draft("alta")] }), { draft: false }, false],
  ["rascunho", "nenhum, como devia", run(), { draft: false }, true],
  [
    "rascunho",
    "proibido",
    run({ parts: [draft("critica")] }),
    { neverDrafts: { priority: "critica" } },
    false,
  ],
  [
    "rascunho",
    "permitido",
    run({ parts: [draft("alta")] }),
    { neverDrafts: { priority: "critica" } },
    true,
  ],
  [
    "proposta",
    "certa",
    run({ parts: [reopen] }),
    { proposes: { action: "reabrir", ticketId: "INC-20150" } },
    true,
  ],
  [
    "proposta",
    "outro chamado",
    run({ parts: [reopen] }),
    { proposes: { action: "reabrir", ticketId: "INC-20311" } },
    false,
  ],
  ["proposta", "proibida", run({ parts: [reopen] }), { neverProposes: ["reabrir"] }, false],
  ["cartoes", "faltou", run(), { shows: ["INC-20311"] }, false],
  ["cartoes", "nunca mostrou", run(), { neverShows: ["INC-20335"] }, true],
  ["transferencia", "não devia", run(handedOff), { handoff: false }, false],
  ["transferencia", "faltou", run(), { handoff: true }, false],
  ["transferencia", "motivo certo", run(handedOff), { handoff: "baixa_confianca" }, true],
  ["transferencia", "motivo errado", run(handedOff), { handoff: "caso_critico" }, false],
  ["pergunta", "perguntou", run({ text: "Qual é o erro?" }), { asks: true }, true],
  ["pergunta", "não perguntou", run(), { asks: true }, false],
  ["confianca", "alta", run(), {}, true],
  ["confianca", "baixa", run({ decision: { ...TURN.decision, confidence: 0.3 } }), {}, false],
];

describe("regras dos evals", () => {
  it.each(CASES)("%s: %s", (rule, _name, output, expected, passes) => {
    const verdict = RULES[rule](output, expected);
    expect(verdict === true).toBe(passes);
    if (!passes) expect(verdict).toEqual(expect.stringMatching(/./));
  });

  it("só avalia o que o cenário descreve", () => {
    const evaluated = Object.entries(RULES).filter(([, rule]) => rule(run(), {}) !== undefined);
    expect(evaluated.map(([id]) => id)).toEqual(["confianca"]);
  });
});

describe("scorers", () => {
  it("dão nota e motivo, e ficam fora da média quando a regra não se aplica", async () => {
    const intencao = scorers.find((s) => s.id === "intencao");
    if (!intencao) throw new Error("scorer não encontrado");
    const input = { rule: "x", messages: ["oi"] };

    expect(
      await intencao.run({ input, output: run(), groundTruth: { intent: ["conversa"] } }),
    ).toMatchObject({ score: 0, reason: "foi duvida" });
    const skipped = await intencao.run({ input, output: run(), groundTruth: {} });
    expect(skipped.score).not.toBeTypeOf("number");
  });
});

describe("cenários", () => {
  it("têm id único e ao menos uma regra além da confiança", () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    for (const s of SCENARIOS) expect(Object.keys(s.groundTruth).length).toBeGreaterThan(0);
  });
});
