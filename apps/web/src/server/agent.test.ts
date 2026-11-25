import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgentTurn } from "@nexo/agent";
import { err, ok } from "@nexo/domain";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { runAgentTurn } = vi.hoisted(() => ({ runAgentTurn: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@nexo/agent", () => ({
  DEFAULT_MODEL: "modelo-de-teste",
  createGeminiModel: () => ({}),
  runAgentTurn,
}));

const NOW = new Date("2026-11-18T17:00:00Z");

const TURN: AgentTurn = {
  text: "Encontrei um artigo.",
  parts: [],
  steps: [{ label: "buscou na central de ajuda", status: "done" }],
  toolCalls: [{ tool: "responder", status: "done", args: "{}" }],
  decision: {
    intent: "duvida",
    understood: "Dúvida de VPN",
    action: "Respondeu",
    confidence: 0.9,
    reason: "Há um artigo.",
  },
  usage: { inputTokens: 10, outputTokens: 5, modelCalls: 1 },
  durationMs: 1200,
};

async function load() {
  const { getDb } = await import("./db/client");
  const { agentTurns, conversations, messages } = await import("./db/schema");
  const { scheduleAgentTurn } = await import("./agent");
  return { db: await getDb(), agentTurns, conversations, messages, scheduleAgentTurn };
}

let ctx: Awaited<ReturnType<typeof load>>;
let conversationId: string;
let employeeMessageId: number;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", `file:${join(mkdtempSync(join(tmpdir(), "nexo-")), "app.db")}`);
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "chave-de-teste");
  vi.stubEnv("AI_TURNS_PER_MINUTE", "4");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  ctx = await load();
});

beforeEach(async () => {
  runAgentTurn.mockReset();
  conversationId = crypto.randomUUID();
  await ctx.db.insert(ctx.conversations).values({
    id: conversationId,
    employeeId: "emp-ana",
    employeeName: "Ana Souza",
    employeeEmail: "ana.souza@nexo.com.br",
    employeeDepartment: "Financeiro",
    status: "agent",
    lastMessageAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const [message] = await ctx.db
    .insert(ctx.messages)
    .values({ conversationId, author: "employee", text: "minha VPN caiu", createdAt: NOW })
    .returning();
  employeeMessageId = message?.id ?? 0;
});

async function turnsAndMessages() {
  const turns = await ctx.db
    .select()
    .from(ctx.agentTurns)
    .where(eq(ctx.agentTurns.conversationId, conversationId));
  const messages = await ctx.db
    .select()
    .from(ctx.messages)
    .where(eq(ctx.messages.conversationId, conversationId));
  return { turns, messages };
}

describe("registro dos turnos do agent", () => {
  it("liga a resposta à mensagem que o agent leu", async () => {
    runAgentTurn.mockResolvedValue(ok(TURN));
    await ctx.scheduleAgentTurn(conversationId);

    const { turns, messages } = await turnsAndMessages();
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      outcome: "answered",
      employeeMessageId,
      replyMessageId: messages.at(-1)?.id,
      intent: "duvida",
      confidence: 0.9,
      toolCalls: TURN.toolCalls,
      durationMs: 1200,
    });
  });

  it("registra a transferência com os motivos e a regra de prioridade", async () => {
    const priority = { priority: "critica", rule: "parado_para_grupo", reason: "x" } as const;
    runAgentTurn.mockResolvedValue(
      ok({ ...TURN, priority, handoff: { reasons: ["caso_critico"], summary: "Equipe parada." } }),
    );
    await ctx.scheduleAgentTurn(conversationId);

    const { turns } = await turnsAndMessages();
    expect(turns[0]).toMatchObject({
      outcome: "handed_off",
      handoffReasons: ["caso_critico"],
      priority,
    });
  });

  it("registra a resposta descartada quando um analista assume no meio do turno", async () => {
    runAgentTurn.mockImplementation(async () => {
      await ctx.db
        .update(ctx.conversations)
        .set({ status: "human" })
        .where(eq(ctx.conversations.id, conversationId));
      return ok(TURN);
    });
    await ctx.scheduleAgentTurn(conversationId);

    const { turns, messages } = await turnsAndMessages();
    expect(turns[0]).toMatchObject({ outcome: "discarded", replyMessageId: null });
    expect(messages).toHaveLength(1);
  });

  it("registra a falha do modelo com o que deu tempo de fazer", async () => {
    runAgentTurn.mockResolvedValue(
      err({
        kind: "model_error",
        message: "quota exceeded",
        steps: TURN.steps,
        toolCalls: TURN.toolCalls,
        durationMs: 800,
      }),
    );
    await ctx.scheduleAgentTurn(conversationId);

    const { turns, messages } = await turnsAndMessages();
    expect(turns[0]).toMatchObject({
      outcome: "model_error",
      error: "quota exceeded",
      confidence: null,
      steps: TURN.steps,
      replyMessageId: messages.at(-1)?.id,
    });
    expect(messages.at(-1)?.author).toBe("system");
  });

  it("registra o turno barrado pelo limite sem chamar o modelo", async () => {
    await ctx.scheduleAgentTurn(conversationId);

    const { turns } = await turnsAndMessages();
    expect(turns[0]).toMatchObject({ outcome: "rate_limited", employeeMessageId });
    expect(runAgentTurn).not.toHaveBeenCalled();
  });
});

describe("lista de decisões", () => {
  it("filtra e conta por baixa confiança, transferência e turnos sem resposta", async () => {
    const { countTurns, listTurns } = await import("./agent-turns");
    const before = await countTurns();
    const base = { conversationId, employeeMessageId, createdAt: NOW };
    await ctx.db.insert(ctx.agentTurns).values([
      { ...base, outcome: "answered", confidence: 0.9 },
      { ...base, outcome: "handed_off", confidence: 0.3 },
      { ...base, outcome: "discarded", confidence: 0.8 },
      { ...base, outcome: "model_error", error: "quota exceeded" },
    ]);

    const after = await countTurns();
    expect({
      todas: after.todas - before.todas,
      baixa: after["baixa-confianca"] - before["baixa-confianca"],
      transferidas: after.transferidas - before.transferidas,
      semResposta: after["sem-resposta"] - before["sem-resposta"],
    }).toEqual({ todas: 4, baixa: 1, transferidas: 1, semResposta: 2 });

    const mine = async (filter: Parameters<typeof listTurns>[0]) =>
      (await listTurns(filter))
        .filter((t) => t.conversationId === conversationId)
        .map((t) => t.outcome);
    expect(await mine("todas")).toEqual(["model_error", "discarded", "handed_off", "answered"]);
    expect(await mine("baixa-confianca")).toEqual(["handed_off"]);
    expect(await mine("transferidas")).toEqual(["handed_off"]);
    expect(await mine("sem-resposta")).toEqual(["model_error", "discarded"]);
  });

  it("mostra quem perguntou e não quebra com um registro fora do formato", async () => {
    const { listTurns } = await import("./agent-turns");
    await ctx.db.insert(ctx.agentTurns).values({
      conversationId,
      employeeMessageId,
      outcome: "answered",
      toolCalls: [{ tool: "" }],
      trace: { quebrado: true },
      createdAt: NOW,
    });

    const [turn] = await listTurns("todas");
    expect(turn).toMatchObject({
      employeeName: "Ana Souza",
      message: "minha VPN caiu",
      toolCalls: [],
      trace: null,
    });
  });
});
