import { EmployeeSchema, TicketSchema, TicketSummarySchema } from "@nexo/domain";
import type { TicketDraft, TicketUpdateAuthor } from "@nexo/domain";
import { z } from "zod";

import { KbSearchResultSchema } from "./contracts.ts";
import { createHttp } from "./http.ts";
import type { HttpOptions } from "./http.ts";

export type TicketStatusFilter = "open" | "closed" | "all";

const seg = encodeURIComponent;

export type TicketClient = ReturnType<typeof createTicketClient>;

export function createTicketClient(options: HttpOptions) {
  const { request } = createHttp(options);
  const tickets = (employeeId: string) => `/employees/${seg(employeeId)}/tickets`;

  return {
    findEmployeeByEmail: (email: string) =>
      request({
        method: "GET",
        path: `/employees?email=${seg(email)}`,
        schema: EmployeeSchema,
        idempotent: true,
      }),

    getEmployee: (employeeId: string) =>
      request({
        method: "GET",
        path: `/employees/${seg(employeeId)}`,
        schema: EmployeeSchema,
        idempotent: true,
      }),

    listTickets: (employeeId: string, status: TicketStatusFilter = "all") =>
      request({
        method: "GET",
        path: `${tickets(employeeId)}?status=${status}`,
        schema: z.array(TicketSummarySchema),
        idempotent: true,
      }),

    getTicket: (employeeId: string, ticketId: string) =>
      request({
        method: "GET",
        path: `${tickets(employeeId)}/${seg(ticketId)}`,
        schema: TicketSchema,
        idempotent: true,
      }),

    // A chave deve vir do rascunho confirmado: confirmar duas vezes o mesmo rascunho não duplica.
    createTicket: (
      employeeId: string,
      draft: TicketDraft,
      idempotencyKey: string = crypto.randomUUID(),
    ) =>
      request({
        method: "POST",
        path: tickets(employeeId),
        body: draft,
        headers: { "Idempotency-Key": idempotencyKey },
        schema: TicketSchema,
        idempotent: true,
      }),

    addUpdate: (
      employeeId: string,
      ticketId: string,
      update: { author: TicketUpdateAuthor; message: string },
    ) =>
      request({
        method: "POST",
        path: `${tickets(employeeId)}/${seg(ticketId)}/updates`,
        body: update,
        schema: TicketSchema,
        idempotent: false,
      }),

    reopenTicket: (employeeId: string, ticketId: string, message: string) =>
      request({
        method: "POST",
        path: `${tickets(employeeId)}/${seg(ticketId)}/reopen`,
        body: { message },
        schema: TicketSchema,
        idempotent: false,
      }),

    transferTicket: (
      employeeId: string,
      ticketId: string,
      transfer: { team: string; summary: string },
    ) =>
      request({
        method: "POST",
        path: `${tickets(employeeId)}/${seg(ticketId)}/transfer`,
        body: transfer,
        schema: TicketSchema,
        idempotent: false,
      }),

    searchKb: (query: string, limit = 3) =>
      request({
        method: "GET",
        path: `/kb/search?q=${seg(query)}&limit=${String(limit)}`,
        schema: z.array(KbSearchResultSchema),
        idempotent: true,
      }),
  };
}
