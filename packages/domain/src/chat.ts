import { z } from "zod";

import { getSlaStatus } from "./sla.ts";
import {
  AffectedSchema,
  CategorySchema,
  PrioritySchema,
  TicketDraftSchema,
  TicketIdSchema,
  TicketStatusSchema,
  TicketTypeSchema,
} from "./ticket.ts";
import type { TicketSummary } from "./ticket.ts";

// Contrato entre o agent e a interface: o que uma mensagem do agent pode mostrar além do texto.

export const AgentStepSchema = z.object({
  label: z.string().min(1),
  status: z.enum(["done", "failed"]),
  detail: z.string().optional(),
});
export type AgentStep = z.infer<typeof AgentStepSchema>;

export const AgentToolCallSchema = z.object({
  tool: z.string().min(1),
  status: z.enum(["done", "failed"]),
  why: z.string().optional(),
  args: z.string(),
  result: z.string().optional(),
});
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;

export const INTENTS = [
  "duvida",
  "consultar_chamado",
  "abrir_chamado",
  "complementar_chamado",
  "reabrir_chamado",
  "falar_com_analista",
  "fora_do_escopo",
  "conversa",
] as const;
export const IntentSchema = z.enum(INTENTS);
export type Intent = z.infer<typeof IntentSchema>;

export const INTENT_LABEL: Record<Intent, string> = {
  duvida: "Tirar uma dúvida",
  consultar_chamado: "Consultar um chamado",
  abrir_chamado: "Abrir um chamado",
  complementar_chamado: "Complementar um chamado",
  reabrir_chamado: "Reabrir um chamado",
  falar_com_analista: "Falar com um analista",
  fora_do_escopo: "Assunto fora de TI",
  conversa: "Conversa geral",
};

// O "porquê" de cada resposta do agent: é o que o painel de detalhes mostra.
export const AgentDecisionSchema = z.object({
  intent: IntentSchema,
  understood: z.string(),
  action: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

// Decisão + custo de uma resposta do agent, guardados junto da mensagem.
export const AgentTraceSchema = z.object({
  decision: AgentDecisionSchema,
  model: z.string(),
  durationMs: z.number(),
  modelCalls: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});
export type AgentTrace = z.infer<typeof AgentTraceSchema>;

export const AGENT_TURN_OUTCOMES = [
  "answered",
  "handed_off",
  "discarded",
  "model_error",
  "rate_limited",
  "not_configured",
] as const;
export type AgentTurnOutcome = (typeof AGENT_TURN_OUTCOMES)[number];

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
  z.object({
    type: z.literal("update_draft"),
    draftId: z.string().min(1),
    action: z.enum(["complementar", "reabrir"]),
    ticketId: TicketIdSchema,
    ticketTitle: z.string(),
    message: z.string().min(1),
    state: z.enum(["pending", "confirmed", "cancelled"]),
  }),
]);
export type MessagePart = z.infer<typeof MessagePartSchema>;

export function toTicketView(ticket: TicketSummary, now: Date): TicketView {
  const sla = getSlaStatus(ticket, now);
  return {
    id: ticket.id,
    type: ticket.type,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    ...(ticket.subcategory === undefined ? {} : { subcategory: ticket.subcategory }),
    priority: ticket.priority,
    status: ticket.status,
    affected: ticket.affected,
    createdAt: ticket.createdAt.toISOString(),
    lastSupportUpdateAt: ticket.lastSupportUpdateAt.toISOString(),
    sla: sla.state === "nao_se_aplica" ? sla : { state: sla.state, dueAt: sla.dueAt.toISOString() },
  };
}
