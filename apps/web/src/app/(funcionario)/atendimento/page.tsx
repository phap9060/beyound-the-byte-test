import type { Metadata } from "next";

import { EmployeeChat } from "@/components/employee/chat";
import {
  countSessionMessages,
  getConversation,
  getEmployeeConversation,
  toChatMessage,
  toState,
} from "@/server/conversations";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Atendimento · Nexo Assist" };

export default async function AtendimentoPage() {
  const user = await requireUser("funcionario");
  const conversation = await getEmployeeConversation(user);
  const [data, used] = await Promise.all([
    getConversation(conversation.id),
    countSessionMessages(user.sessionId),
  ]);

  return (
    <EmployeeChat
      conversationId={conversation.id}
      firstName={user.name.split(" ")[0] ?? user.name}
      initialMessages={(data?.messages ?? []).map(toChatMessage)}
      initialState={toState(data?.conversation ?? conversation)}
      initialUsed={used}
    />
  );
}
