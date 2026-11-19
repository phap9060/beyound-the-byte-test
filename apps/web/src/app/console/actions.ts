"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyAnalystAction, sendAnalystMessage } from "@/server/conversations";
import type { ConversationError } from "@/server/conversations";
import { requireUser } from "@/server/session";

export interface ActionState {
  error?: string;
}

function describe(error: ConversationError): string {
  switch (error.kind) {
    case "not_found":
      return "Conversa não encontrada.";
    case "not_allowed":
      return "Essa ação não está disponível no estado atual da conversa. Atualize a página.";
    case "not_yours":
      return `Esta conversa está com ${error.assignedTo ?? "outro analista"}.`;
  }
}

const ActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["assume", "return_to_agent", "close_by_analyst"]),
});

export async function conversationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const analyst = await requireUser("analista");
  const parsed = ActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ação inválida." };

  const result = await applyAnalystAction(parsed.data.id, parsed.data.action, analyst);
  revalidatePath("/console", "layout");
  return result.ok ? {} : { error: describe(result.error) };
}

const MessageSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, "Escreva uma mensagem.").max(2000),
});

export async function analystMessageAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const analyst = await requireUser("analista");
  const parsed = MessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };

  const result = await sendAnalystMessage(parsed.data.id, analyst, parsed.data.text);
  revalidatePath("/console", "layout");
  return result.ok ? {} : { error: describe(result.error) };
}
