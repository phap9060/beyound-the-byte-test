import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db/client.ts";
import { searchKb } from "../services/kb.ts";
import { validate } from "../validation.ts";

export function kbRoutes(db: Database) {
  const app = new Hono();

  app.get(
    "/search",
    validate(
      "query",
      z.object({
        q: z.string().trim().min(2).max(500),
        limit: z.coerce.number().int().min(1).max(10).default(3),
      }),
    ),
    async (c) => {
      const { q, limit } = c.req.valid("query");
      return c.json(await searchKb(db, q, limit));
    },
  );

  return app;
}
