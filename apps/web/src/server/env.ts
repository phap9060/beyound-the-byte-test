import "server-only";

import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./data/app.db"),
  TICKET_SERVICE_URL: z.url().default("http://localhost:4001"),
  TICKET_SERVICE_TOKEN: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  AI_TURNS_PER_MINUTE: z.coerce.number().int().positive().default(6),
  AI_TURNS_PER_USER_HOUR: z.coerce.number().int().positive().default(40),
  AI_TURNS_PER_DAY: z.coerce.number().int().positive().default(500),
});

const parsed = EnvSchema.safeParse(process.env);

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
  sessionSecret: parsed.data.SESSION_SECRET ?? "dev-only-secret-do-not-use-in-production!!",
  isProduction: parsed.data.NODE_ENV === "production",
  googleApiKey: parsed.data.GOOGLE_GENERATIVE_AI_API_KEY,
  aiModel: parsed.data.AI_MODEL,
  limits: {
    turnsPerMinute: parsed.data.AI_TURNS_PER_MINUTE,
    turnsPerUserHour: parsed.data.AI_TURNS_PER_USER_HOUR,
    turnsPerDay: parsed.data.AI_TURNS_PER_DAY,
  },
};
