import "server-only";

import { createTicketClient } from "@nexo/ticket-client";

import { env } from "./env";

export const tickets = createTicketClient({
  baseUrl: env.ticketServiceUrl,
  token: env.ticketServiceToken,
});
