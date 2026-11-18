import type { AddressInfo } from "node:net";

import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createTicketClient } from "@nexo/ticket-client";
import type { HttpOptions, RetryInfo } from "@nexo/ticket-client";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app.ts";
import { openDatabase } from "./db/client.ts";
import { seedIfEmpty } from "./db/seed.ts";
import { CHAOS_OFF } from "./middlewares/chaos.ts";
import type { ChaosConfig } from "./middlewares/chaos.ts";

// Gerador pseudoaleatório com semente: a instabilidade varia, mas o teste é reproduzível.
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let server: ServerType | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

async function start(chaos: Partial<ChaosConfig>) {
  const db = await openDatabase(":memory:");
  await seedIfEmpty(db);
  const app = createApp(db, {
    chaos: { ...CHAOS_OFF, ...chaos },
    chaosDeps: { random: seeded(42), log: () => undefined },
  });

  const port = await new Promise<number>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0 }, (info: AddressInfo) => {
      resolve(info.port);
    });
  });

  const baseUrl = `http://localhost:${String(port)}`;
  const retries: RetryInfo[] = [];
  const client = (options: Partial<HttpOptions> = {}) =>
    createTicketClient({
      baseUrl,
      retry: { baseDelayMs: 20, maxDelayMs: 3000 },
      onRetry: (info) => retries.push(info),
      ...options,
    });

  const forceOutage = (durationMs: number) =>
    fetch(`${baseUrl}/_chaos/outage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMs }),
    });

  return { client, retries, forceOutage };
}

const draft = {
  type: "INC",
  title: "VPN não conecta — erro 809",
  description: "Desde ontem o notebook (Windows 11) não conecta na VPN e mostra o erro 809.",
  category: "rede_vpn",
  priority: "alta",
  affected: "somente_eu",
} as const;

describe("ticket-client contra o serviço instável", () => {
  it("com 30% de falhas, todas as consultas terminam bem", async () => {
    const { client, retries } = await start({ failureRate: 0.3, latencyMs: { min: 0, max: 10 } });
    const c = client();

    const results = [];
    for (let i = 0; i < 30; i++) results.push(await c.listTickets("emp-ana", "open"));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(retries.length).toBeGreaterThan(0);
  });

  it("com falhas, criar o mesmo rascunho várias vezes gera um único chamado", async () => {
    const { client } = await start({ failureRate: 0.3 });
    const c = client();

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () => c.createTicket("emp-ana", draft, "draft-D-381")),
    );

    const ids = new Set(attempts.map((r) => (r.ok ? r.value.id : "falhou")));
    expect(ids).toEqual(new Set(["INC-20336"]));

    const open = await c.listTickets("emp-ana", "open");
    expect(open.ok && open.value.filter((t) => t.title === draft.title)).toHaveLength(1);
  });

  it("rascunhos diferentes criados ao mesmo tempo ganham números diferentes", async () => {
    const { client } = await start({});
    const c = client();

    const created = await Promise.all(
      ["a", "b", "c", "d"].map((k) => c.createTicket("emp-ana", draft, `draft-${k}`)),
    );

    const ids = created.map((r) => (r.ok ? r.value.id : "falhou"));
    expect(new Set(ids).size).toBe(4);
  });

  it("numa queda curta, espera o Retry-After e se recupera", async () => {
    const { client, retries, forceOutage } = await start({});
    const c = client();
    await forceOutage(1200);

    const started = Date.now();
    const result = await c.searchKb("vpn erro 809");

    expect(result.ok).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
    expect(retries[0]).toMatchObject({ reason: "server_unavailable", delayMs: 2000 });
  });

  it("numa queda longa, desiste dentro do prazo em vez de prender o funcionário", async () => {
    const { client, forceOutage } = await start({});
    const c = client({ deadlineMs: 2500 });
    await forceOutage(30_000);

    const started = Date.now();
    const result = await c.listTickets("emp-ana");

    expect(result).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "deadline", attempts: 1 },
    });
    expect(Date.now() - started).toBeLessThan(2500);
  });
});
