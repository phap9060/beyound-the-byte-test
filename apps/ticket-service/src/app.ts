import { sql } from "drizzle-orm";
import { Hono } from "hono";

import type { Database } from "./db/client.ts";
import { errorResponse, serviceError } from "./errors.ts";
import { requireToken } from "./middlewares/auth.ts";
import { CHAOS_OFF, createChaos } from "./middlewares/chaos.ts";
import type { ChaosConfig, ChaosDeps } from "./middlewares/chaos.ts";
import { chaosRoutes } from "./routes/chaos.ts";
import { employeeRoutes } from "./routes/employees.ts";
import { kbRoutes } from "./routes/kb.ts";

export interface AppOptions {
  token?: string | undefined;
  now?: () => Date;
  chaos?: ChaosConfig;
  chaosDeps?: ChaosDeps;
}

export function createApp(db: Database, options: AppOptions = {}) {
  const now = options.now ?? (() => new Date());
  const chaos = createChaos(options.chaos ?? CHAOS_OFF, options.chaosDeps);
  const app = new Hono();

  app.get("/health", async (c) => {
    await db.run(sql`select 1`);
    return c.json({ status: "ok" });
  });

  if (options.token) app.use("*", requireToken(options.token));

  app.route("/_chaos", chaosRoutes(chaos));

  app.use("/employees/*", chaos.middleware);
  app.use("/kb/*", chaos.middleware);
  app.route("/employees", employeeRoutes(db, now));
  app.route("/kb", kbRoutes(db));

  app.notFound((c) => errorResponse(c, serviceError("not_found", "Rota não encontrada")));

  // Erros de negócio voltam como Result. Aqui só chegam falhas inesperadas (bug, banco fora).
  app.onError((error, c) => {
    console.error("[ticket-service] erro inesperado", error);
    return errorResponse(c, serviceError("internal_error", "Erro interno no serviço de chamados"));
  });

  return app;
}
