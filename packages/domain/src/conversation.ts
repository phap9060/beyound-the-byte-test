import { z } from "zod";

export const CONVERSATION_STATUSES = ["agent", "waiting_human", "human", "closed"] as const;
export const ConversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const MESSAGE_AUTHORS = ["employee", "agent", "analyst", "system"] as const;
export const MessageAuthorSchema = z.enum(MESSAGE_AUTHORS);
export type MessageAuthor = z.infer<typeof MessageAuthorSchema>;

export const CLOSED_BY = ["agent", "analyst"] as const;
export type ClosedBy = (typeof CLOSED_BY)[number];

export const MAX_MESSAGES_PER_SESSION = 30;
