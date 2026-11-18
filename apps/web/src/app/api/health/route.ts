import { sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { tickets } from "@/server/tickets";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  await db.run(sql`select 1`);

  const ticketService = await tickets.searchKb("horário", 1);

  return Response.json({
    status: "ok",
    database: "ok",
    ticketService: ticketService.ok ? "ok" : ticketService.error.kind,
  });
}
