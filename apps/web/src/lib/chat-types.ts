import type { AgentStep, ConversationStatus, MessageAuthor, MessagePart } from "@nexo/domain";

// Formato que o servidor manda ao navegador (na página e pelo SSE). Datas em ISO.

export interface ChatMessage {
  id: number;
  author: MessageAuthor;
  authorName: string | null;
  authorTeam: string | null;
  text: string;
  parts: MessagePart[];
  steps: AgentStep[];
  createdAt: string;
}

export interface ConversationState {
  status: ConversationStatus;
  analystName: string | null;
  waitingUntil: string | null;
}

export type ConversationEvent =
  { type: "message"; message: ChatMessage } | { type: "state"; state: ConversationState };
