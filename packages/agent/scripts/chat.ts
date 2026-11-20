// Conversa com o agent pelo terminal, mostrando cada decisão. Precisa do ticket-service rodando.
// Uso: pnpm --filter @nexo/agent chat [email]
import { createInterface } from "node:readline/promises";

import { HANDOFF_REASON_LABEL, INTENT_LABEL } from "@nexo/domain";
import type { MessagePart } from "@nexo/domain";
import { createTicketClient } from "@nexo/ticket-client";

import { createGeminiModel, runAgentTurn } from "../src/index.ts";
import type { HistoryItem } from "../src/index.ts";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error("Defina GOOGLE_GENERATIVE_AI_API_KEY em apps/web/.env");
  process.exit(1);
}

const email = process.argv[2] ?? "ana.souza@nexo.com.br";
const client = createTicketClient({
  baseUrl: process.env.TICKET_SERVICE_URL ?? "http://localhost:4001",
  token: process.env.TICKET_SERVICE_TOKEN,
});
const model = createGeminiModel({ apiKey, model: process.env.AI_MODEL });

const employee = await client.findEmployeeByEmail(email);
if (!employee.ok) {
  console.error("Não consegui achar o funcionário. O ticket-service está rodando?", employee.error);
  process.exit(1);
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function describe(part: MessagePart): string {
  switch (part.type) {
    case "text":
      return part.text;
    case "quick_options":
      return `[opções] ${part.options.map((o) => `${o.value}) ${o.label}`).join("  ")}`;
    case "ticket_list":
      return `[lista] ${part.tickets.map((t) => `${t.id} ${t.title} (${t.sla.state})`).join(" · ")}`;
    case "ticket_card":
      return `[card] ${part.ticket.id} ${part.ticket.title} (${part.ticket.status}, ${part.ticket.sla.state})`;
    case "draft":
      return `[rascunho] ${part.draft.type} · ${part.draft.category} · ${part.draft.priority} · ${part.draft.title}\n    ${part.draft.description}`;
    case "update_draft":
      return `[${part.action}] ${part.ticketId}: ${part.message}`;
  }
}

console.log(dim(`Conversando como ${employee.value.name}. Ctrl+C para sair.\n`));
const history: HistoryItem[] = [];
const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.setPrompt(bold("você › "));
rl.prompt();
for await (const line of rl) {
  const message = line.trim();
  if (!message) {
    rl.prompt();
    continue;
  }
  if (!process.stdin.isTTY) console.log(message);

  const result = await runAgentTurn({
    model,
    client,
    employee: { id: employee.value.id, name: employee.value.name },
    history,
    message,
  });
  if (!result.ok) {
    console.log(`\x1b[31merro do modelo: ${result.error.message}\x1b[0m\n`);
    rl.prompt();
    continue;
  }

  const turn = result.value;
  for (const s of turn.steps) {
    console.log(
      dim(`  ${s.status === "done" ? "✓" : "✗"} ${s.label}${s.detail ? ` · ${s.detail}` : ""}`),
    );
  }
  console.log(`${bold("nexo ›")} ${turn.text}`);
  for (const p of turn.parts) console.log(`  ${describe(p)}`);

  const d = turn.decision;
  console.log(
    dim(
      `  ─ entendeu: ${d.understood}\n  ─ intenção: ${INTENT_LABEL[d.intent]} · ação: ${d.action} · confiança: ${String(Math.round(d.confidence * 100))}%\n  ─ por quê: ${d.reason}`,
    ),
  );
  if (turn.handoff) {
    console.log(
      `\x1b[33m  → transferido: ${turn.handoff.reasons.map((r) => HANDOFF_REASON_LABEL[r]).join(", ")}\n    resumo: ${turn.handoff.summary}\x1b[0m`,
    );
  }
  console.log(
    dim(
      `  ─ ${String(turn.durationMs)} ms · ${String(turn.usage.modelCalls)} chamadas ao modelo · ${String(turn.usage.inputTokens)} tokens de entrada, ${String(turn.usage.outputTokens)} de saída\n`,
    ),
  );

  history.push({ author: "employee", authorName: null, text: message, parts: [], steps: [] });
  history.push({
    author: "agent",
    authorName: null,
    text: turn.text,
    parts: turn.parts,
    steps: turn.steps,
  });
  rl.prompt();
}
