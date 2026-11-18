import type { Priority } from "./ticket.ts";

export type HandoffReason =
  "pedido_do_funcionario" | "caso_critico" | "chamado_vencido" | "baixa_confianca";

export const HANDOFF_REASON_LABEL: Record<HandoffReason, string> = {
  pedido_do_funcionario: "O funcionário pediu para falar com um analista",
  caso_critico: "Caso crítico",
  chamado_vencido: "Chamado com prazo vencido",
  baixa_confianca: "O agent não teve segurança para decidir",
};

// Valor inicial; será calibrado com os evals.
export const CONFIDENCE_THRESHOLD = 0.6;

export interface HandoffInput {
  userAskedForHuman: boolean;
  priority?: Priority;
  ticketOverdue?: boolean;
  // 0 a 1
  confidence: number;
}

export function evaluateHandoff(input: HandoffInput): HandoffReason[] {
  const reasons: HandoffReason[] = [];
  if (input.userAskedForHuman) reasons.push("pedido_do_funcionario");
  if (input.priority === "critica") reasons.push("caso_critico");
  if (input.ticketOverdue === true) reasons.push("chamado_vencido");
  if (input.confidence < CONFIDENCE_THRESHOLD) reasons.push("baixa_confianca");
  return reasons;
}
