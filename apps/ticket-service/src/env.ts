import { err, ok } from "@nexo/domain";
import type { Result } from "@nexo/domain";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.string().min(1).default("file:./data/tickets.db"),
  TICKET_SERVICE_TOKEN: z.string().min(16).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Result<Env, string> {
  const parsed = EnvSchema.safeParse(source);
  return parsed.success
    ? ok(parsed.data)
    : err(`Configuração inválida do ticket-service:\n${z.prettifyError(parsed.error)}`);
}
