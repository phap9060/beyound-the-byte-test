import "server-only";

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import { env } from "../env";
import * as schema from "./schema";
import { seedConversationsIfEmpty } from "./seed";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

async function open(url: string): Promise<Database> {
  if (url.startsWith("file:")) mkdirSync(dirname(url.slice("file:".length)), { recursive: true });

  const client = createClient({ url });
  const db = drizzle(client, { schema });
  await client.execute("PRAGMA foreign_keys = ON");
  // import.meta.url aponta para o bundle do Next, então as migrações são achadas pelo cwd.
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  await seedConversationsIfEmpty(db);
  return db;
}

// Em dev o Next recarrega módulos a cada mudança; guardar no globalThis evita abrir o banco de novo.
const cache = globalThis as unknown as { nexoDb?: Promise<Database> };

export function getDb(): Promise<Database> {
  cache.nexoDb ??= open(env.databaseUrl);
  return cache.nexoDb;
}
