"use server";

import { z } from "zod";

import type { ChatMessage } from "@/lib/chat-types";
import { postEmployeeMessage } from "@/server/conversations";
import { requireUser } from "@/server/session";

export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: string };

const TextSchema = z
  .string()
  .trim()
  .min(1, "Escreva uma mensagem.")
  .max(2000, "Mensagem muito longa.");

export async function sendEmployeeMessage(text: string): Promise<SendResult> {
  const user = await requireUser("funcionario");
  const parsed = TextSchema.safeParse(text);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };

  const result = await postEmployeeMessage(user, parsed.data);
  if (result.ok) return { ok: true, message: result.value };
  return {
    ok: false,
    error:
      result.error.kind === "limit_reached"
        ? "Você atingiu o limite de mensagens desta sessão."
        : "Não foi possível enviar agora. Tente de novo.",
  };
}
