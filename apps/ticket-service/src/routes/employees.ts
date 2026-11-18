import { TicketDraftSchema, TicketUpdateAuthorSchema } from "@nexo/domain";
import type { Result } from "@nexo/domain";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

import type { Database } from "../db/client.ts";
import { errorResponse, serviceError } from "../errors.ts";
import type { ServiceError } from "../errors.ts";
import { requireEmployee } from "../middlewares/require-employee.ts";
import { findEmployeeByEmail, getEmployee } from "../services/employees.ts";
import {
  addUpdate,
  createTicket,
  getTicket,
  listTickets,
  reopenTicket,
  transferTicket,
} from "../services/tickets.ts";
import { validate } from "../validation.ts";

const message = z.string().trim().min(1).max(2000);

function respond<T>(
  c: Context,
  result: Result<T, ServiceError>,
  status: ContentfulStatusCode = 200,
) {
  return result.ok ? c.json(result.value as object, status) : errorResponse(c, result.error);
}

export function employeeRoutes(db: Database, now: () => Date) {
  const app = new Hono();

  app.use("/:employeeId/tickets/*", requireEmployee(db));

  app.get("/", validate("query", z.object({ email: z.email() })), async (c) => {
    return respond(c, await findEmployeeByEmail(db, c.req.valid("query").email));
  });

  app.get("/:employeeId", async (c) => {
    return respond(c, await getEmployee(db, c.req.param("employeeId")));
  });

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
      return errorResponse(
        c,
        serviceError(
          "missing_idempotency_key",
          "O cabeçalho Idempotency-Key é obrigatório para criar chamados",
        ),
      );
    }

    const result = await createTicket(db, employeeId, c.req.valid("json"), key, now());
    if (!result.ok) return errorResponse(c, result.error);
    return c.json(result.value.ticket, result.value.created ? 201 : 200);
  });

  app.get("/:employeeId/tickets/:ticketId", async (c) => {
    const { employeeId, ticketId } = c.req.param();
    return respond(c, await getTicket(db, employeeId, ticketId));
  });

  app.post(
    "/:employeeId/tickets/:ticketId/updates",
    validate("json", z.object({ author: TicketUpdateAuthorSchema, message })),
    async (c) => {
      const { employeeId, ticketId } = c.req.param();
      return respond(c, await addUpdate(db, employeeId, ticketId, c.req.valid("json"), now()));
    },
  );

  app.post(
    "/:employeeId/tickets/:ticketId/reopen",
    validate("json", z.object({ message })),
    async (c) => {
      const { employeeId, ticketId } = c.req.param();
      return respond(
        c,
        await reopenTicket(db, employeeId, ticketId, c.req.valid("json").message, now()),
      );
    },
  );

  app.post(
    "/:employeeId/tickets/:ticketId/transfer",
    validate("json", z.object({ team: z.string().trim().min(1).max(60), summary: message })),
    async (c) => {
      const { employeeId, ticketId } = c.req.param();
      return respond(c, await transferTicket(db, employeeId, ticketId, c.req.valid("json"), now()));
    },
  );

  return app;
}
