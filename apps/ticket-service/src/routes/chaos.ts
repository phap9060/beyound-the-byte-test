import { Hono } from "hono";
import { z } from "zod";

import type { Chaos } from "../middlewares/chaos.ts";
import { validate } from "../validation.ts";

const rate = z.number().min(0).max(1);
const ms = z.number().int().min(0).max(60_000);

const PatchSchema = z
  .object({
    failureRate: rate,
    latencyMs: z.object({ min: ms, max: ms }).refine((l) => l.min <= l.max, {
      message: "min deve ser ≤ max",
    }),
    outageRate: rate,
    outageMs: ms,
  })
  .partial();

export function chaosRoutes(chaos: Chaos) {
  const app = new Hono();

  app.get("/", (c) => c.json(chaos.status()));

  app.patch("/", validate("json", PatchSchema), (c) => {
    const patch = Object.fromEntries(
      Object.entries(c.req.valid("json")).filter(([, v]) => v !== undefined),
    );
    return c.json(chaos.update(patch));
  });

  app.post("/outage", validate("json", z.object({ durationMs: ms.optional() })), (c) => {
    chaos.startOutage(c.req.valid("json").durationMs);
    return c.json(chaos.status());
  });

  app.delete("/outage", (c) => {
    chaos.stopOutage();
    return c.json(chaos.status());
  });

  return app;
}
