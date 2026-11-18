import { sql } from "drizzle-orm";
import { Hono } from "hono";

import { requireToken } from "./auth.ts";
import type { Database } from "./db/client.ts";
import { errorResponse, serviceError } from "./errors.ts";
import { employeeRoutes } from "./routes/employees.ts";
import { kbRoutes } from "./routes/kb.ts";

export interface AppOptions {
  token?: string | undefined;
  now?: () => Date;
}

export function createApp(db: Database, options: AppOptions = {}) {
  const now = options.now ?? (() => new Date());
  const app = new Hono();

  app.get("/health", async (c) => {
    await db.run(sql`select 1`);
    return c.json({ status: "ok" });
  });

  if (options.token) app.use("*", requireToken(options.token));

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
