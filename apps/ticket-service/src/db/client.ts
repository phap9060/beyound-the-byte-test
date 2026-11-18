import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema.ts";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * Abre o banco e aplica as migrações pendentes. Assim o serviço sobe com o
 * esquema certo sem nenhum passo manual.
 */
export async function openDatabase(url: string): Promise<Database> {
  if (url.startsWith("file:")) {
    // Garante que a pasta do arquivo existe (ex.: ./data na primeira execução).
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  }

  const client = createClient({ url });
  const db = drizzle(client, { schema });

  // Chaves estrangeiras vêm desligadas no SQLite por padrão.
  await client.execute("PRAGMA foreign_keys = ON");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return db;
}
