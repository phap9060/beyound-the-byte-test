import { z } from "zod";

import { addBusinessMinutes } from "./business-time.ts";
import { err, ok } from "./result.ts";
import type { Result } from "./result.ts";
import type { Priority } from "./ticket.ts";

export const CONVERSATION_STATUSES = ["agent", "waiting_human", "human", "closed"] as const;
export const ConversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const MESSAGE_AUTHORS = ["employee", "agent", "analyst", "system"] as const;
export const MessageAuthorSchema = z.enum(MESSAGE_AUTHORS);
export type MessageAuthor = z.infer<typeof MessageAuthorSchema>;

export const CLOSED_BY = ["agent", "analyst"] as const;
export type ClosedBy = (typeof CLOSED_BY)[number];

export const MAX_MESSAGES_PER_SESSION = 30;

export type ConversationAction =
  | "handoff"
  | "assume"
  | "return_to_agent"
  | "close_by_analyst"
  | "close_by_agent"
  | "employee_writes";

// Quem pode o quê. O agent só responde em "agent"; nos outros estados ele fica pausado (Anexo A).
const TRANSITIONS: Record<
  ConversationAction,
  Partial<Record<ConversationStatus, ConversationStatus>>
> = {
  handoff: { agent: "waiting_human" },
  assume: { agent: "human", waiting_human: "human" },
  return_to_agent: { waiting_human: "agent", human: "agent" },
  close_by_analyst: { waiting_human: "closed", human: "closed" },
  close_by_agent: { agent: "closed" },
  employee_writes: { closed: "agent" },
};

export function transitionConversation(
  from: ConversationStatus,
  action: ConversationAction,
): Result<ConversationStatus, { from: ConversationStatus; action: ConversationAction }> {
  const to = TRANSITIONS[action][from];
  return to ? ok(to) : err({ from, action });
}

export function agentCanReply(status: ConversationStatus): boolean {
  return status === "agent";
}

// Prazo para um analista assumir a conversa transferida: crítico em 1 h corrida, o resto em 2 h úteis.
export function handoffDeadline(handedOffAt: Date, priority?: Priority): Date {
  return priority === "critica"
    ? new Date(handedOffAt.getTime() + 60 * 60 * 1000)
    : addBusinessMinutes(handedOffAt, 120);
}
