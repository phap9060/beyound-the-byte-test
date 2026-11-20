import type {
  AgentStep,
  HandoffReason,
  MessagePart,
  PriorityDecision,
  TicketView,
} from "@nexo/domain";

export type ProposalPart = Extract<MessagePart, { type: "draft" | "update_draft" }>;

export interface HandoffRequest {
  reason: HandoffReason;
  summary: string;
  ticketId?: string;
}

export interface TurnRecorder {
  readonly steps: AgentStep[];
  readonly seen: Map<string, TicketView>;
  readonly proposals: ProposalPart[];
  handoff: HandoffRequest | undefined;
  priority: PriorityDecision | undefined;
  step: (label: string, status: AgentStep["status"], detail?: string) => void;
  remember: (tickets: TicketView[]) => void;
}

export function createRecorder(): TurnRecorder {
  const steps: AgentStep[] = [];
  const seen = new Map<string, TicketView>();
  return {
    steps,
    seen,
    proposals: [],
    handoff: undefined,
    priority: undefined,
    step(label, status, detail) {
      steps.push(detail === undefined ? { label, status } : { label, status, detail });
    },
    remember(tickets) {
      for (const t of tickets) seen.set(t.id, t);
    },
  };
}
