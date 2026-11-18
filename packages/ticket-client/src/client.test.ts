import { describe, expect, it } from "vitest";

import { createTicketClient } from "./client.ts";
import type { HttpOptions, RetryInfo } from "./index.ts";

type Step = Response | Error;

const ticket = {
  id: "INC-20311",
  type: "INC",
  title: "Notebook lento após atualização",
  description: "Lentidão geral desde a atualização do Windows.",
  category: "hardware",
  priority: "media",
  affected: "somente_eu",
  status: "aguardando_analista",
  requesterId: "emp-ana",
  createdAt: "2026-11-12T13:00:00.000Z",
  lastSupportUpdateAt: "2026-11-12T13:00:00.000Z",
  updates: [],
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const unavailable = (retryAfter?: string) =>
  json(
    503,
    { error: { code: "service_unavailable", message: "fora" } },
    retryAfter ? { "Retry-After": retryAfter } : {},
  );

const timeout = () => new DOMException("tempo esgotado", "TimeoutError");

function setup(steps: Step[], options: Partial<HttpOptions> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const retries: RetryInfo[] = [];
  let clock = 0;

  const client = createTicketClient({
    baseUrl: "http://tickets.test/",
    fetch: (input, init = {}) => {
      calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
      const step = steps.shift();
      if (!step) throw new Error("fetch chamado mais vezes do que o esperado");
      return step instanceof Error ? Promise.reject(step) : Promise.resolve(step);
    },
    sleep: (ms) => {
      sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    now: () => clock,
    random: () => 1,
    onRetry: (info) => retries.push(info),
    ...options,
  });

  const header = (i: number, name: string) => new Headers(calls[i]?.init.headers).get(name);
  return { client, calls, sleeps, retries, header };
}

describe("respostas", () => {
  it("valida e converte a resposta (datas viram Date)", async () => {
    const { client, calls } = setup([json(200, ticket)]);

    const result = await client.getTicket("emp-ana", "INC-20311");

    expect(result.ok && result.value.createdAt).toBeInstanceOf(Date);
    expect(calls[0]?.url).toBe("http://tickets.test/employees/emp-ana/tickets/INC-20311");
  });

  it("erro de negócio vira kind service, sem nova tentativa", async () => {
    const { client, calls } = setup([
      json(404, { error: { code: "ticket_not_found", message: "Chamado não encontrado" } }),
    ]);

    expect(await client.getTicket("emp-ana", "INC-1")).toEqual({
      ok: false,
      error: {
        kind: "service",
        status: 404,
        code: "ticket_not_found",
        message: "Chamado não encontrado",
      },
    });
    expect(calls).toHaveLength(1);
  });

  it("resposta fora do contrato vira invalid_response", async () => {
    const { client } = setup([json(200, { id: 123 })]);
    const result = await client.getTicket("emp-ana", "INC-20311");
    expect(!result.ok && result.error.kind).toBe("invalid_response");
  });

  it("envia o token quando configurado", async () => {
    const { client, header } = setup([json(200, [])], { token: "segredo-com-16-chars" });
    await client.listTickets("emp-ana");
    expect(header(0, "Authorization")).toBe("Bearer segredo-com-16-chars");
  });
});

describe("novas tentativas", () => {
  it("503 e depois sucesso: tenta de novo e devolve o resultado", async () => {
    const { client, calls, retries } = setup([unavailable(), json(200, [])]);

    expect(await client.listTickets("emp-ana", "open")).toEqual({ ok: true, value: [] });
    expect(calls).toHaveLength(2);
    expect(retries).toMatchObject([{ attempt: 1, reason: "server_unavailable" }]);
  });

  it("falha de rede também é repetida", async () => {
    const { client, calls } = setup([new TypeError("fetch failed"), json(200, [])]);
    expect((await client.searchKb("vpn")).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("espera cresce exponencialmente: 250, 500, 1000 ms", async () => {
    const { client, sleeps } = setup([unavailable(), unavailable(), unavailable(), json(200, [])]);
    await client.listTickets("emp-ana");
    expect(sleeps).toEqual([250, 500, 1000]);
  });

  it("respeita o Retry-After quando ele pede mais tempo", async () => {
    const { client, sleeps } = setup([unavailable("3"), json(200, [])]);
    await client.listTickets("emp-ana");
    expect(sleeps).toEqual([3000]);
  });

  it("desiste depois do número máximo de tentativas", async () => {
    const { client, calls } = setup([unavailable(), unavailable(), unavailable(), unavailable()]);

    expect(await client.listTickets("emp-ana")).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "server_unavailable", attempts: 4 },
    });
    expect(calls).toHaveLength(4);
  });

  it("desiste antes se a espera estourar o prazo total da chamada", async () => {
    const { client, calls } = setup([unavailable("10"), json(200, [])], { deadlineMs: 5000 });

    const result = await client.listTickets("emp-ana");

    expect(result).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "deadline", attempts: 1 },
    });
    expect(calls).toHaveLength(1);
  });
});

describe("idempotência", () => {
  const draft = {
    type: "INC",
    title: "VPN não conecta",
    description: "Erro 809 no Windows 11 desde ontem.",
    category: "rede_vpn",
    priority: "alta",
    affected: "somente_eu",
  } as const;

  it("criar chamado repete com a mesma chave em todas as tentativas", async () => {
    const { client, header } = setup([timeout(), unavailable(), json(201, ticket)]);

    const result = await client.createTicket("emp-ana", draft, "draft-D-381");

    expect(result.ok).toBe(true);
    expect([0, 1, 2].map((i) => header(i, "Idempotency-Key"))).toEqual([
      "draft-D-381",
      "draft-D-381",
      "draft-D-381",
    ]);
  });

  it("sem chave informada, gera uma e reaproveita nas tentativas", async () => {
    const { client, header } = setup([unavailable(), json(201, ticket)]);
    await client.createTicket("emp-ana", draft);
    expect(header(0, "Idempotency-Key")).toBeTruthy();
    expect(header(1, "Idempotency-Key")).toBe(header(0, "Idempotency-Key"));
  });

  it("timeout ao adicionar informação não é repetido (poderia duplicar)", async () => {
    const { client, calls } = setup([timeout(), json(200, ticket)]);

    const result = await client.addUpdate("emp-ana", "INC-20311", {
      author: "funcionario",
      message: "Travou de novo.",
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "timeout", attempts: 1 },
    });
    expect(calls).toHaveLength(1);
  });

  it("503 ao adicionar informação é repetido (o servidor recusou antes de gravar)", async () => {
    const { client, calls } = setup([unavailable(), json(200, ticket)]);
    const result = await client.addUpdate("emp-ana", "INC-20311", {
      author: "funcionario",
      message: "Travou de novo.",
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });
});
