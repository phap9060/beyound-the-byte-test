import type {
  AgentStep,
  AgentTrace,
  ConversationStatus,
  MessageAuthor,
  MessagePart,
} from "@nexo/domain";

// Formato que o servidor manda ao navegador (na página e pelo SSE). Datas em ISO.

export interface ChatMessage {
  id: number;
  author: MessageAuthor;
  authorName: string | null;
  authorTeam: string | null;
  text: string;
  parts: MessagePart[];
  steps: AgentStep[];
  trace: AgentTrace | null;
  createdAt: string;
}

export interface ConversationState {
  status: ConversationStatus;
  analystName: string | null;
  waitingUntil: string | null;
}

// "message_updated" troca uma mensagem já enviada (ex.: rascunho confirmado) e não move o cursor do SSE.
export type ConversationEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "message_updated"; message: ChatMessage }
  | { type: "state"; state: ConversationState }
  | { type: "agent"; working: boolean };
