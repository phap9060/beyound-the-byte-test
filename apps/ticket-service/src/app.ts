import { sql } from "drizzle-orm";
import { Hono } from "hono";

import type { Database } from "./db/client.ts";

/**
 * Monta as rotas do serviço. Recebe o banco como parâmetro (injeção de
 * dependência): o servidor real passa o arquivo SQLite, e os testes passam um
 * banco em memória.
 */
export function createApp(db: Database) {
  const app = new Hono();

  app.get("/health", async (c) => {
    await db.run(sql`select 1`);
    return c.json({ status: "ok" });
  });

  return app;
}
