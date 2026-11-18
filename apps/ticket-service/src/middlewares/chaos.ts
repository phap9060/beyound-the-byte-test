import { createMiddleware } from "hono/factory";

import { errorResponse, serviceError } from "../errors.ts";

// Simula o sistema legado instável do PDF: latência, falhas soltas e quedas de alguns segundos.
export interface ChaosConfig {
  failureRate: number;
  latencyMs: { min: number; max: number };
  outageRate: number;
  outageMs: number;
}

export const CHAOS_OFF: ChaosConfig = {
  failureRate: 0,
  latencyMs: { min: 0, max: 0 },
  outageRate: 0,
  outageMs: 4000,
};

export interface ChaosDeps {
  random?: () => number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

export interface ChaosStatus {
  config: ChaosConfig;
  outageRemainingMs: number;
}

export type Chaos = ReturnType<typeof createChaos>;

export function createChaos(initial: ChaosConfig, deps: ChaosDeps = {}) {
  const random = deps.random ?? Math.random;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log =
    deps.log ??
    ((m: string) => {
      console.log(m);
    });

  let config: ChaosConfig = structuredClone(initial);
  let outageUntil = 0;

  function startOutage(ms = config.outageMs): void {
    outageUntil = now() + ms;
    log(`[ticket-service] queda simulada por ${String(Math.round(ms / 1000))} s`);
  }

  function stopOutage(): void {
    outageUntil = 0;
  }

  function status(): ChaosStatus {
    return { config, outageRemainingMs: Math.max(0, outageUntil - now()) };
  }

  function update(patch: Partial<ChaosConfig>): ChaosStatus {
    config = { ...config, ...patch };
    return status();
  }

  const middleware = createMiddleware(async (c, next) => {
    const { min, max } = config.latencyMs;
    const delay = max > min ? min + random() * (max - min) : min;
    if (delay > 0) await sleep(delay);

    if (outageUntil <= now() && random() < config.outageRate) startOutage();

    const remaining = outageUntil - now();
    if (remaining > 0) {
      c.header("Retry-After", String(Math.ceil(remaining / 1000)));
      return errorResponse(
        c,
        serviceError("service_unavailable", "Serviço de chamados temporariamente indisponível", {
          reason: "outage",
        }),
      );
    }

    if (random() < config.failureRate) {
      c.header("Retry-After", "1");
      return errorResponse(
        c,
        serviceError("service_unavailable", "Serviço de chamados temporariamente indisponível", {
          reason: "transient",
        }),
      );
    }

    await next();
    return undefined;
  });

  return { middleware, status, update, startOutage, stopOutage };
}
