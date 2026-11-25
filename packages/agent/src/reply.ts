import { createTool } from "@mastra/core/tools";
import { IntentSchema, TicketIdSchema } from "@nexo/domain";
import { z } from "zod";

export const ReplySchema = z.object({
  mensagem: z.string().min(1).describe("O texto para o funcionário"),
  intencao: IntentSchema,
  entendimento: z.string().min(1).describe("Em uma frase, o que você entendeu do pedido"),
  confianca: z.number().min(0).max(1),
  motivo: z.string().min(1).describe("Por que respondeu ou agiu assim"),
  opcoes: z
    .object({
      pergunta: z.string().optional(),
      itens: z.array(z.string().min(1).max(80)).min(2).max(6),
      numeradas: z
        .boolean()
        .describe("true quando as opções forem uma lista para escolher por número"),
    })
    .optional(),
  mostrarChamados: z.array(TicketIdSchema).max(10).optional(),
});
export type Reply = z.infer<typeof ReplySchema>;

export const REPLY_TOOL = "responder";

export const replyTool = createTool({
  id: REPLY_TOOL,
  description: "Envia a resposta ao funcionário e encerra o turno. Chame sempre, por último.",
  inputSchema: ReplySchema,
});
