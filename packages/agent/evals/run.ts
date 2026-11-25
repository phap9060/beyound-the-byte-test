import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { runExperiment } from "@mastra/core/datasets";
import type { ItemWithScores } from "@mastra/core/datasets";
import { Mastra } from "@mastra/core/mastra";

import { DEFAULT_MODEL, createGeminiModel } from "../src/model.ts";
import { runAgentTurn } from "../src/run.ts";
import type { HistoryItem } from "../src/history.ts";
import { ANA, NOW, createFakeClient } from "../src/testing/fixtures.ts";

import { SCENARIOS } from "./scenarios.ts";
import type { EvalRun, ScenarioInput } from "./scenarios.ts";
import { scorers } from "./scorers.ts";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    repeat: { type: "string", default: "1" },
    delay: { type: "string", default: "10000" },
  },
});

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error("Defina GOOGLE_GENERATIVE_AI_API_KEY em apps/web/.env");
  process.exit(1);
}
const modelName = process.env.AI_MODEL ?? DEFAULT_MODEL;
const model = createGeminiModel({ apiKey, model: modelName });
const repeat = Math.max(1, Number(values.repeat));
const delay = Number(values.delay);
const only = values.only?.split(",");
const scenarios = only ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;

const QUOTA_WAIT_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function play({ messages }: ScenarioInput): Promise<EvalRun> {
  const { client, calls } = createFakeClient();
  const run: EvalRun = { turns: [], calls };
  const history: HistoryItem[] = [];

  for (const message of messages) {
    let result = await runAgentTurn({ model, client, employee: ANA, history, message, now: NOW });

    for (let retry = 0; !result.ok && retry < 2; retry++) {
      console.log(`    modelo indisponível, tentando de novo em ${String(QUOTA_WAIT_MS / 1000)} s`);
      await sleep(QUOTA_WAIT_MS);
      result = await runAgentTurn({ model, client, employee: ANA, history, message, now: NOW });
    }

    if (!result.ok) throw new Error(result.error.message);
    const turn = result.value;
    run.turns.push(turn);
    history.push({ author: "employee", authorName: null, text: message, parts: [], steps: [] });
    history.push({
      author: "agent",
      authorName: null,
      text: turn.text,
      parts: turn.parts,
      steps: turn.steps,
    });
    await sleep(delay);
  }
  return run;
}

const runOf = (item: ItemWithScores) => item.output as EvalRun | null;
const turnsOf = (item: ItemWithScores) => runOf(item)?.turns ?? [];

function failuresOf(item: ItemWithScores): string[] {
  if (item.error) return [`erro: ${item.error.message}`];
  return item.scores.flatMap((s) => {
    if (s.error) return [`${s.scorerId}: erro no avaliador (${s.error})`];
    return s.score === null || s.score === 1 ? [] : [`${s.scorerId}: ${s.reason ?? "falhou"}`];
  });
}

const summary = await runExperiment(new Mastra({ logger: false }), {
  name: `${modelName} ${new Date().toISOString()}`,
  data: scenarios.flatMap(({ id, input, groundTruth }) =>
    Array.from({ length: repeat }, (_, i) => ({
      id: repeat > 1 ? `${id} #${String(i + 1)}` : id,
      input,
      groundTruth,
    })),
  ),
  task: ({ input }) => play(input as ScenarioInput),
  scorers,
  maxConcurrency: 1,
  afterEach: ({ result }) => {
    const failures = failuresOf(result);
    const ms = turnsOf(result).reduce((s, t) => s + t.durationMs, 0);
    console.log(`${failures.length === 0 ? "✓" : "✗"} ${result.itemId} · ${String(ms)} ms`);
    for (const f of failures) console.log(`    ${f}`);
    if (failures.length === 0) return;
    for (const t of turnsOf(result)) {
      console.log(`    agent: ${t.text.replaceAll("\n", " ")}`);
      console.log(
        `    por quê: ${t.decision.reason} · passos: ${t.steps.map((st) => st.label).join(", ")}`,
      );
    }
  },
});

const items = summary.results;
const errors = items.filter((i) => i.error);
const passed = items.filter((i) => failuresOf(i).length === 0).length;
const turns = items.flatMap(turnsOf);
const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const sorted = turns.map((t) => t.durationMs).sort((a, b) => a - b);
const stats = {
  passRate: items.length ? passed / items.length : 0,
  avgMs: avg(sorted),
  p90Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0,
  avgCalls: avg(turns.map((t) => t.usage.modelCalls)),
  avgInput: avg(turns.map((t) => t.usage.inputTokens)),
  avgOutput: avg(turns.map((t) => t.usage.outputTokens)),
  minConfidence: Math.min(...turns.map((t) => t.decision.confidence)),
};

const rules = scorers.map(({ id }) => {
  const scores = items.flatMap((i) =>
    i.scores.flatMap((s) => (s.scorerId === id && s.score !== null ? [s.score] : [])),
  );
  return { id, evaluated: scores.length, average: avg(scores) };
});

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
console.log(
  `\n${String(passed)}/${String(items.length)} cenários (${pct(stats.passRate)}), ${String(errors.length)} com erro · ${String(turns.length)} turnos · média ${(stats.avgMs / 1000).toFixed(1)} s (p90 ${(stats.p90Ms / 1000).toFixed(1)} s) · ${stats.avgCalls.toFixed(1)} chamadas e ${stats.avgInput.toFixed(0)}+${stats.avgOutput.toFixed(0)} tokens por turno`,
);
for (const r of rules) {
  if (r.evaluated > 0) console.log(`  ${r.id}: ${pct(r.average)} de ${String(r.evaluated)}`);
}

const ruleRows = rules
  .filter((r) => r.evaluated > 0)
  .map((r) => `| ${r.id} | ${pct(r.average)} | ${String(r.evaluated)} |`);
const rows = items.map((i) => {
  const failures = failuresOf(i);
  const confidence = turnsOf(i).map((t) => t.decision.confidence.toFixed(2));
  return `| ${failures.length === 0 ? "✓" : "✗"} | ${i.itemId} | ${(i.input as ScenarioInput).rule} | ${confidence.join(", ")} | ${failures.join("; ") || "—"} |`;
});

const report = `# Resultado dos evals

Gerado por \`pnpm --filter @nexo/agent eval\` em ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC, com o modelo \`${modelName}\`${repeat > 1 ? `, ${String(repeat)} execuções por cenário` : ""}.

- **${String(passed)}/${String(items.length)} cenários passaram (${pct(stats.passRate)})**, ${String(errors.length)} com erro de execução
- Tempo por turno: média ${(stats.avgMs / 1000).toFixed(1)} s, p90 ${(stats.p90Ms / 1000).toFixed(1)} s
- Custo por turno: ${stats.avgCalls.toFixed(1)} chamadas ao modelo, ${stats.avgInput.toFixed(0)} tokens de entrada e ${stats.avgOutput.toFixed(0)} de saída
- Menor confiança registrada: ${stats.minConfidence.toFixed(2)}

## Por regra

| Regra | Acerto | Avaliações |
|---|---|---|
${ruleRows.join("\n")}

## Por cenário

| | Cenário | Regra | Confiança por turno | Falhas |
|---|---|---|---|---|
${rows.join("\n")}
`;
if (!only) {
  writeFileSync(new URL("./report.md", import.meta.url), report);
  console.log("Relatório em packages/agent/evals/report.md");
}

process.exitCode = stats.passRate >= 0.9 ? 0 : 1;
