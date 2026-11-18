import { count } from "drizzle-orm";

import type { Database } from "./client.ts";
import { employees, kbArticles, ticketUpdates, tickets } from "./schema.ts";
import { buildSeedData } from "./seed-data.ts";

export async function seedIfEmpty(db: Database, now = new Date()): Promise<boolean> {
  const [row] = await db.select({ total: count() }).from(employees);
  if (row && row.total > 0) return false;

  const data = buildSeedData(now);
  await db.transaction(async (tx) => {
    await tx.insert(employees).values(data.employees);
    await tx.insert(tickets).values(data.tickets);
    await tx.insert(ticketUpdates).values(data.ticketUpdates);
    await tx.insert(kbArticles).values(data.kbArticles);
  });
  return true;
}
