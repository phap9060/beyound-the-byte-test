import "server-only";

import { EventEmitter } from "node:events";

import type { ConversationEvent } from "@/lib/chat-types";

// Barramento em memória: basta para um processo. Com várias instâncias, isto vira Redis ou LISTEN/NOTIFY.
const cache = globalThis as unknown as { nexoBus?: EventEmitter };
const bus = (cache.nexoBus ??= new EventEmitter().setMaxListeners(0));

const conversationChannel = (id: string) => `conversation:${id}`;
const CONSOLE = "console";

export function publish(conversationId: string, event: ConversationEvent): void {
  bus.emit(conversationChannel(conversationId), event);
  bus.emit(CONSOLE, conversationId);
}

export function onConversation(id: string, listener: (event: ConversationEvent) => void) {
  bus.on(conversationChannel(id), listener);
  return () => {
    bus.off(conversationChannel(id), listener);
  };
}

export function onConsole(listener: (conversationId: string) => void) {
  bus.on(CONSOLE, listener);
  return () => {
    bus.off(CONSOLE, listener);
  };
}
