import { TicketDraftSchema, TicketUpdateAuthorSchema } from "@nexo/domain";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db/client.ts";
import { AppError } from "../errors.ts";
import { findEmployeeByEmail, getEmployee } from "../services/employees.ts";
import {
  addUpdate,
  assertEmployeeExists,
  createTicket,
  getTicket,
  listTickets,
  reopenTicket,
  transferTicket,
} from "../services/tickets.ts";
import { validate } from "../validation.ts";

const message = z.string().trim().min(1).max(2000);

export function employeeRoutes(db: Database, now: () => Date) {
  const app = new Hono();

  app.get("/", validate("query", z.object({ email: z.email() })), async (c) => {
    return c.json(await findEmployeeByEmail(db, c.req.valid("query").email));
  });

  app.get("/:employeeId", async (c) => {
    return c.json(await getEmployee(db, c.req.param("employeeId")));
  });

  for (const path of ["/:employeeId/tickets", "/:employeeId/tickets/*"]) {
    app.use(path, async (c, next) => {
      await assertEmployeeExists(db, c.req.param("employeeId") ?? "");
      await next();
    });
  }

  app.get(
    "/:employeeId/tickets",
    validate("query", z.object({ status: z.enum(["open", "closed", "all"]).default("all") })),
    async (c) => {
      const employeeId = c.req.param("employeeId");
      return c.json(await listTickets(db, employeeId, c.req.valid("query").status));
    },
  );

  app.post("/:employeeId/tickets", validate("json", TicketDraftSchema), async (c) => {
    const employeeId = c.req.param("employeeId");
    const key = c.req.header("Idempotency-Key")?.trim();
    if (!key || key.length > 200) {
      throw new AppError(
        "missing_idempotency_key",
        "O cabeçalho Idempotency-Key é obrigatório para criar chamados",
      );
    }

    const { ticket, created } = await createTicket(db, employeeId, c.req.valid("json"), key, now());
    return c.json(ticket, created ? 201 : 200);
  });

  app.get("/:employeeId/tickets/:ticketId", async (c) => {
    const { employeeId, ticketId } = c.req.param();
    return c.json(await getTicket(db, employeeId, ticketId));
  });

  app.post(
    "/:employeeId/tickets/:ticketId/updates",
    validate("json", z.object({ author: TicketUpdateAuthorSchema, message })),
    async (c) => {
      const { employeeId, ticketId } = c.req.param();
      return c.json(await addUpdate(db, employeeId, ticketId, c.req.valid("json"), now()));
    },
  );

  app.post(
    "/:employeeId/tickets/:ticketId/reopen",
    validate("json", z.object({ message })),
    async (c) => {
      const { employeeId, ticketId } = c.req.param();
      return c.json(
        await reopenTicket(db, employeeId, ticketId, c.req.valid("json").message, now()),
      );
    },
  );

  app.post(
    "/:employeeId/tickets/:ticketId/transfer",
    validate("json", z.object({ team: z.string().trim().min(1).max(60), summary: message })),
    async (c) => {
      const { employeeId, ticketId } = c.req.param();
      return c.json(await transferTicket(db, employeeId, ticketId, c.req.valid("json"), now()));
    },
  );

  return app;
}
