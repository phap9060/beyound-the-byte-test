import "server-only";

import { and, count, eq } from "drizzle-orm";

import { getDb } from "./db/client";
import { messages } from "./db/schema";

export async function countSessionMessages(sessionId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ total: count() })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.author, "employee")));
  return row?.total ?? 0;
}
