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

const { port, databaseUrl, token, chaos } = env.value;
const db = await openDatabase(databaseUrl);
if (await seedIfEmpty(db)) {
  console.log("[ticket-service] banco vazio: dados de exemplo criados");
}

const app = createApp(db, { token, chaos });
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[ticket-service] ouvindo em http://localhost:${info.port}`);
});
