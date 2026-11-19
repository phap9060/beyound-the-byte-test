import "server-only";

import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./data/app.db"),
  TICKET_SERVICE_URL: z.url().default("http://localhost:4001"),
  TICKET_SERVICE_TOKEN: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = EnvSchema.safeParse(process.env);

// Sem configuração válida o app não tem como funcionar: falha na subida, com a mensagem do que falta.
if (!parsed.success) {
  console.error(`Configuração inválida do web:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

const isBuild = process.env.NEXT_PHASE === "phase-production-build";
if (parsed.data.NODE_ENV === "production" && !parsed.data.SESSION_SECRET && !isBuild) {
  console.error("SESSION_SECRET é obrigatório em produção (mínimo de 32 caracteres).");
  process.exit(1);
}

export const env = {
  databaseUrl: parsed.data.DATABASE_URL,
  ticketServiceUrl: parsed.data.TICKET_SERVICE_URL,
  ticketServiceToken: parsed.data.TICKET_SERVICE_TOKEN,
  // Em desenvolvimento um segredo fixo evita configuração; em produção ele é exigido acima.
  sessionSecret: parsed.data.SESSION_SECRET ?? "dev-only-secret-do-not-use-in-production!!",
  isProduction: parsed.data.NODE_ENV === "production",
};
