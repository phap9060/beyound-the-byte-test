import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.string().min(1).default("file:./data/tickets.db"),
  TICKET_SERVICE_TOKEN: z.string().min(16).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configuração inválida do ticket-service:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
