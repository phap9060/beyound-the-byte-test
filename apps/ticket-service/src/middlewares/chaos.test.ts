import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.ts";
import { openDatabase } from "../db/client.ts";
import type { Database } from "../db/client.ts";
import { seedIfEmpty } from "../db/seed.ts";
import { CHAOS_OFF } from "./chaos.ts";
import type { ChaosConfig } from "./chaos.ts";

let db: Database;
let clock: number;
let rolls: number[];
let sleeps: number[];

beforeEach(async () => {
  db = await openDatabase(":memory:");
  await seedIfEmpty(db);
  clock = 1_000_000;
  rolls = [];
  sleeps = [];
});

function appWith(chaos: Partial<ChaosConfig>) {
  return createApp(db, {
    chaos: { ...CHAOS_OFF, ...chaos },
    chaosDeps: {
      random: () => rolls.shift() ?? 0.99,
      now: () => clock,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      log: () => undefined,
    },
  });
}

const TICKETS = "/employees/emp-ana/tickets";

async function body(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe("instabilidade simulada", () => {
  it("desligada, não interfere", async () => {
    const res = await appWith({}).request(TICKETS);
    expect(res.status).toBe(200);
    expect(sleeps).toEqual([]);
  });

  it("aplica latência dentro da faixa configurada", async () => {
    rolls = [0.5];
    await appWith({ latencyMs: { min: 100, max: 300 } }).request(TICKETS);
    expect(sleeps).toEqual([200]);
  });

  it("falha solta: 503 sem Retry-After (vale tentar de novo logo)", async () => {
    rolls = [0.99, 0.01];
    const res = await appWith({ failureRate: 0.05 }).request(TICKETS);

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBeNull();
    expect(await body(res)).toMatchObject({
      error: { code: "service_unavailable", details: { reason: "transient" } },
    });
  });

  it("queda: tudo fica fora por alguns segundos e depois volta", async () => {
    const app = appWith({ outageRate: 0.01, outageMs: 4000 });

    rolls = [0.001];
    const first = await app.request(TICKETS);
    expect(first.status).toBe(503);
    expect(first.headers.get("Retry-After")).toBe("4");

    clock += 2500;
    const during = await app.request("/kb/search?q=vpn");
    expect(during.status).toBe(503);
    expect(await body(during)).toMatchObject({ error: { details: { reason: "outage" } } });

    clock += 1600;
    expect((await app.request(TICKETS)).status).toBe(200);
  });

  it("o /health não é afetado", async () => {
    const app = appWith({ failureRate: 1 });
    expect((await app.request("/health")).status).toBe(200);
  });
});

describe("controle em tempo real (/_chaos)", () => {
  it("força uma queda e encerra antes do tempo", async () => {
    const app = appWith({});

    const started = await app.request("/_chaos/outage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMs: 10_000 }),
    });
    expect(await body(started)).toMatchObject({ outageRemainingMs: 10_000 });
    expect((await app.request(TICKETS)).status).toBe(503);

    await app.request("/_chaos/outage", { method: "DELETE" });
    expect((await app.request(TICKETS)).status).toBe(200);
  });

  it("altera a configuração sem reiniciar o serviço", async () => {
    const app = appWith({});

    const res = await app.request("/_chaos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ failureRate: 1 }),
    });
    expect(await body(res)).toMatchObject({ config: { failureRate: 1, outageMs: 4000 } });

    rolls = [0.99, 0.5];
    expect((await app.request(TICKETS)).status).toBe(503);
  });

  it("recusa configuração inválida", async () => {
    const res = await appWith({}).request("/_chaos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ failureRate: 2 }),
    });
    expect(res.status).toBe(400);
  });
});
