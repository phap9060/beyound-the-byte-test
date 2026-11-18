import { err, ok } from "@nexo/domain";
import type { Result } from "@nexo/domain";
import { z } from "zod";

import type { ChaosConfig } from "./middlewares/chaos.ts";

const rate = z.coerce.number().min(0).max(1);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.string().min(1).default("file:./data/tickets.db"),
  TICKET_SERVICE_TOKEN: z.string().min(16).optional(),
  CHAOS_FAILURE_RATE: rate.default(0),
  CHAOS_LATENCY_MS: z
    .string()
    .regex(/^\d+-\d+$/, 'use o formato "min-max", ex.: 100-400')
    .default("0-0")
    .transform((v) => {
      const [min = 0, max = 0] = v.split("-").map(Number);
      return { min, max };
    })
    .refine((l) => l.min <= l.max, "min deve ser ≤ max"),
  CHAOS_OUTAGE_RATE: rate.default(0),
  CHAOS_OUTAGE_MS: z.coerce.number().int().min(0).default(4000),
});

export interface Env {
  port: number;
  databaseUrl: string;
  token: string | undefined;
  chaos: ChaosConfig;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Result<Env, string> {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    return err(`Configuração inválida do ticket-service:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  return ok({
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    token: e.TICKET_SERVICE_TOKEN,
    chaos: {
      failureRate: e.CHAOS_FAILURE_RATE,
      latencyMs: e.CHAOS_LATENCY_MS,
      outageRate: e.CHAOS_OUTAGE_RATE,
      outageMs: e.CHAOS_OUTAGE_MS,
    },
  });
}
