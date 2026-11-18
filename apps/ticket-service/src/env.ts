import { z } from "zod";

/**
 * Configuração lida das variáveis de ambiente e validada na inicialização.
 * Se algo estiver errado, o serviço nem sobe, e a mensagem diz o quê.
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  /** Arquivo SQLite. `:memory:` é usado nos testes. */
  DATABASE_URL: z.string().min(1).default("file:./data/tickets.db"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configuração inválida do ticket-service:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
