import { sql } from "drizzle-orm";
import { Hono } from "hono";

import type { Database } from "./db/client.ts";

export function createApp(db: Database) {
  const app = new Hono();

  app.get("/health", async (c) => {
    await db.run(sql`select 1`);
    return c.json({ status: "ok" });
  });

  return app;
}
