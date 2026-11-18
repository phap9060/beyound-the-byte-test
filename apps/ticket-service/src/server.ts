import { serve } from "@hono/node-server";

import { createApp } from "./app.ts";
import { openDatabase } from "./db/client.ts";
import { seedIfEmpty } from "./db/seed.ts";
import { loadEnv } from "./env.ts";

const env = loadEnv();
if (!env.ok) {
  console.error(env.error);
  process.exit(1);
}

const { PORT, DATABASE_URL, TICKET_SERVICE_TOKEN } = env.value;
const db = await openDatabase(DATABASE_URL);
if (await seedIfEmpty(db)) {
  console.log("[ticket-service] banco vazio: dados de exemplo criados");
}

const app = createApp(db, { token: TICKET_SERVICE_TOKEN });
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[ticket-service] ouvindo em http://localhost:${info.port}`);
});
