import { z } from "zod";

import {
  AffectedSchema,
  CategorySchema,
  PrioritySchema,
  TicketDraftSchema,
  TicketIdSchema,
  TicketStatusSchema,
  TicketTypeSchema,
} from "./ticket.ts";

// Contrato entre o agent e a interface: o que uma mensagem do agent pode mostrar além do texto.

export const AgentStepSchema = z.object({
  label: z.string().min(1),
  status: z.enum(["done", "failed"]),
});
export type AgentStep = z.infer<typeof AgentStepSchema>;

export const TicketViewSchema = z.object({
  id: TicketIdSchema,
  type: TicketTypeSchema,
  title: z.string(),
  description: z.string(),
  category: CategorySchema,
  subcategory: z.string().optional(),
  priority: PrioritySchema,
  status: TicketStatusSchema,
  affected: AffectedSchema,
  createdAt: z.iso.datetime(),
  lastSupportUpdateAt: z.iso.datetime(),
  sla: z.discriminatedUnion("state", [
    z.object({ state: z.literal("no_prazo"), dueAt: z.iso.datetime() }),
    z.object({ state: z.literal("vencido"), dueAt: z.iso.datetime() }),
    z.object({ state: z.literal("nao_se_aplica") }),
  ]),
});
export type TicketView = z.infer<typeof TicketViewSchema>;

export const QuickOptionSchema = z.object({ value: z.string().min(1), label: z.string().min(1) });
export type QuickOption = z.infer<typeof QuickOptionSchema>;

export const MessagePartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("quick_options"),
    question: z.string().optional(),
    numbered: z.boolean(),
    options: z.array(QuickOptionSchema).min(1),
  }),
  z.object({ type: z.literal("ticket_list"), tickets: z.array(TicketViewSchema).min(1) }),
  z.object({ type: z.literal("ticket_card"), ticket: TicketViewSchema }),
  z.object({
    type: z.literal("draft"),
    draftId: z.string().min(1),
    draft: TicketDraftSchema,
    dueAt: z.iso.datetime(),
    state: z.enum(["pending", "confirmed", "cancelled"]),
    ticketId: TicketIdSchema.optional(),
  }),
]);
export type MessagePart = z.infer<typeof MessagePartSchema>;
