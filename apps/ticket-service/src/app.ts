import { sql } from "drizzle-orm";
import { Hono } from "hono";

import { requireToken } from "./auth.ts";
import type { Database } from "./db/client.ts";
import { AppError, errorBody } from "./errors.ts";
import type { ErrorBody } from "./errors.ts";
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

  app.notFound((c) =>
    c.json<ErrorBody>({ error: { code: "not_found", message: "Rota não encontrada" } }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json(errorBody(err), err.status);
    console.error("[ticket-service] erro inesperado", err);
    return c.json<ErrorBody>(
      { error: { code: "internal_error", message: "Erro interno no serviço de chamados" } },
      500,
    );
  });

  return app;
}
