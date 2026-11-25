"use server";

import { after } from "next/server";
import { z } from "zod";

import type { ChatMessage } from "@/lib/chat-types";
import { scheduleAgentTurn } from "@/server/agent";
import { postEmployeeMessage } from "@/server/conversations";
import { resolveProposal } from "@/server/proposals";
import type { ProposalError } from "@/server/proposals";
import { requireUser } from "@/server/session";

export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

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
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error.kind === "limit_reached"
          ? "Você atingiu o limite de mensagens desta sessão."
          : "Não foi possível enviar agora. Tente de novo.",
    };
  }

  const { conversationId } = result.value;
  after(() => scheduleAgentTurn(conversationId));
  return { ok: true, message: result.value.message };
}

const ProposalInput = z.object({
  messageId: z.number().int().positive(),
  draftId: z.string().min(1).max(100),
  choice: z.enum(["confirm", "cancel"]),
});

function describe(error: ProposalError): string {
  switch (error.kind) {
    case "not_found":
      return "Não encontrei esse rascunho.";
    case "already_resolved":
      return "Esse rascunho já foi resolvido.";
    case "busy":
      return "Já estou processando esse rascunho.";
    case "ticket_service":
      return error.error.kind === "unavailable"
        ? "O sistema de chamados está fora do ar agora. Tente de novo em instantes; nada foi duplicado."
        : "O sistema de chamados recusou o pedido. Tente de novo ou fale com um analista.";
  }
}

export async function resolveProposalAction(input: {
  messageId: number;
  draftId: string;
  choice: "confirm" | "cancel";
}): Promise<ActionResult> {
  const user = await requireUser("funcionario");
  const parsed = ProposalInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };

  const { messageId, draftId, choice } = parsed.data;
  const result = await resolveProposal(user, messageId, draftId, choice);
  return result.ok ? { ok: true } : { ok: false, error: describe(result.error) };
}
