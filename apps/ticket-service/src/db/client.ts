import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema.ts";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function openDatabase(url: string): Promise<Database> {
  if (url.startsWith("file:")) {
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  }

  const client = createClient({ url });
  const db = drizzle(client, { schema });

  // O SQLite vem com chaves estrangeiras desligadas por padrão.
  await client.execute("PRAGMA foreign_keys = ON");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return db;
}
