// Roda os cenários contra o modelo real, com o serviço de chamados em memória.
// Uso: pnpm --filter @nexo/agent eval [--only id1,id2] [--repeat 3]
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { DEFAULT_MODEL, createGeminiModel } from "../src/model.ts";
import { runAgentTurn } from "../src/run.ts";
import type { HistoryItem } from "../src/history.ts";
import { ANA, NOW, createFakeClient } from "../src/testing/fixtures.ts";

import { SCENARIOS, confident } from "./scenarios.ts";
import type { EvalRun, Scenario } from "./scenarios.ts";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    repeat: { type: "string", default: "1" },
    // Pausa entre turnos para caber no limite de requisições por minuto do plano gratuito.
    delay: { type: "string", default: "4000" },
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

interface Outcome {
  scenario: Scenario;
  attempt: number;
  failures: string[];
  error?: string;
  run: EvalRun;
}

async function play(scenario: Scenario): Promise<Omit<Outcome, "scenario" | "attempt">> {
  const { client, calls } = createFakeClient();
  const run: EvalRun = { turns: [], calls };
  const history: HistoryItem[] = [];

  for (const message of scenario.messages) {
    let result = await runAgentTurn({ model, client, employee: ANA, history, message, now: NOW });
    // Estourar a cota por minuto do plano gratuito não diz nada sobre a qualidade: espera e repete.
    for (let retry = 0; !result.ok && retry < 2; retry++) {
      console.log(`    modelo indisponível, tentando de novo em ${String(QUOTA_WAIT_MS / 1000)} s`);
      await sleep(QUOTA_WAIT_MS);
      result = await runAgentTurn({ model, client, employee: ANA, history, message, now: NOW });
    }
    if (!result.ok) return { failures: [], error: result.error.message, run };
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

  // Vale para todo cenário: nenhum deles deveria cair em baixa confiança ou no caminho de contingência.
  const failures = [...scenario.checks, confident].flatMap((check) => {
    const result = check.run(run);
    return result === true ? [] : [`${check.name}: ${result}`];
  });
  return { failures, run };
}

const outcomes: Outcome[] = [];
for (const scenario of scenarios) {
  for (let attempt = 1; attempt <= repeat; attempt++) {
    const outcome = { scenario, attempt, ...(await play(scenario)) };
    outcomes.push(outcome);
    const ok = !outcome.error && outcome.failures.length === 0;
    const turns = outcome.run.turns;
    const ms = turns.reduce((s, t) => s + t.durationMs, 0);
    console.log(
      `${ok ? "✓" : "✗"} ${scenario.id}${repeat > 1 ? ` #${String(attempt)}` : ""} · ${String(ms)} ms`,
    );
    if (outcome.error) console.log(`    erro: ${outcome.error}`);
    for (const f of outcome.failures) console.log(`    ${f}`);
    if (!ok) {
      for (const t of turns) {
        console.log(`    agent: ${t.text.replaceAll("\n", " ")}`);
        console.log(
          `    por quê: ${t.decision.reason} · passos: ${t.steps.map((st) => st.label).join(", ")}`,
        );
      }
    }
  }
}

const turns = outcomes.flatMap((o) => o.run.turns);
const passed = outcomes.filter((o) => !o.error && o.failures.length === 0).length;
const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const sorted = turns.map((t) => t.durationMs).sort((a, b) => a - b);
const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0;
const summary = {
  passRate: outcomes.length ? passed / outcomes.length : 0,
  avgMs: avg(turns.map((t) => t.durationMs)),
  p90Ms: p90,
  avgCalls: avg(turns.map((t) => t.usage.modelCalls)),
  avgInput: avg(turns.map((t) => t.usage.inputTokens)),
  avgOutput: avg(turns.map((t) => t.usage.outputTokens)),
  minConfidence: Math.min(...turns.map((t) => t.decision.confidence)),
};

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
console.log(
  `\n${String(passed)}/${String(outcomes.length)} cenários (${pct(summary.passRate)}) · ${String(turns.length)} turnos · média ${(summary.avgMs / 1000).toFixed(1)} s (p90 ${(summary.p90Ms / 1000).toFixed(1)} s) · ${summary.avgCalls.toFixed(1)} chamadas e ${summary.avgInput.toFixed(0)}+${summary.avgOutput.toFixed(0)} tokens por turno`,
);

const rows = outcomes.map((o) => {
  const ok = !o.error && o.failures.length === 0;
  const detail = o.error ?? o.failures.join("; ");
  const conf = o.run.turns.map((t) => t.decision.confidence.toFixed(2)).join(", ");
  return `| ${ok ? "✓" : "✗"} | \`${o.scenario.id}\`${repeat > 1 ? ` #${String(o.attempt)}` : ""} | ${o.scenario.rule} | ${conf} | ${detail || "—"} |`;
});

const report = `# Resultado dos evals

Gerado por \`pnpm --filter @nexo/agent eval\` em ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC, com o modelo \`${modelName}\`${repeat > 1 ? `, ${String(repeat)} execuções por cenário` : ""}.

- **${String(passed)}/${String(outcomes.length)} cenários passaram (${pct(summary.passRate)})**
- Tempo por turno: média ${(summary.avgMs / 1000).toFixed(1)} s, p90 ${(summary.p90Ms / 1000).toFixed(1)} s
- Custo por turno: ${summary.avgCalls.toFixed(1)} chamadas ao modelo, ${summary.avgInput.toFixed(0)} tokens de entrada e ${summary.avgOutput.toFixed(0)} de saída
- Menor confiança registrada: ${summary.minConfidence.toFixed(2)}

| | Cenário | Regra | Confiança por turno | Falhas |
|---|---|---|---|---|
${rows.join("\n")}
`;
// Só a suíte completa vira relatório; rodar alguns cenários com --only não sobrescreve o resultado.
if (!only) {
  writeFileSync(new URL("./report.md", import.meta.url), report);
  console.log("Relatório em packages/agent/evals/report.md");
}

process.exitCode = summary.passRate >= 0.9 ? 0 : 1;
