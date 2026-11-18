import { describe, expect, it } from "vitest";

import { createApp } from "./app.ts";
import { openDatabase } from "./db/client.ts";

describe("ticket-service", () => {
  it("GET /health responde ok com o banco migrado", async () => {
    const app = createApp(await openDatabase(":memory:"));

    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
