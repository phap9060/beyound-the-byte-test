import { serve } from "@hono/node-server";

import { createApp } from "./app.ts";
import { openDatabase } from "./db/client.ts";
import { seedIfEmpty } from "./db/seed.ts";
import { loadEnv } from "./env.ts";

const env = loadEnv();
const db = await openDatabase(env.DATABASE_URL);
if (await seedIfEmpty(db)) {
  console.log("[ticket-service] banco vazio: dados de exemplo criados");
}
const app = createApp(db);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[ticket-service] ouvindo em http://localhost:${info.port}`);
});
