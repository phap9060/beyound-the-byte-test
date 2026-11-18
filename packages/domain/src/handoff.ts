import type { Priority } from "./ticket.ts";

/**
 * Quando transferir para um analista (Anexo A): quando o funcionário pede,
 * em casos críticos, em chamados vencidos ou quando o agent não tem
 * segurança sobre o que fazer.
 */
export type HandoffReason =
  "pedido_do_funcionario" | "caso_critico" | "chamado_vencido" | "baixa_confianca";

export const HANDOFF_REASON_LABEL: Record<HandoffReason, string> = {
  pedido_do_funcionario: "O funcionário pediu para falar com um analista",
  caso_critico: "Caso crítico",
  chamado_vencido: "Chamado com prazo vencido",
  baixa_confianca: "O agent não teve segurança para decidir",
};

/**
 * Abaixo desta confiança (0 a 1) o agent não age sozinho. O valor é um
 * ponto de partida e será calibrado com os evals.
 */
export const CONFIDENCE_THRESHOLD = 0.6;

export interface HandoffInput {
  userAskedForHuman: boolean;
  /** Prioridade do caso em questão, se já houver uma. */
  priority?: Priority;
  /** O chamado em discussão está vencido? */
  ticketOverdue?: boolean;
  /** Confiança do agent na interpretação/ação, de 0 a 1. */
  confidence: number;
}

/** Devolve todos os motivos que se aplicam. Lista vazia significa que não é preciso transferir. */
export function evaluateHandoff(input: HandoffInput): HandoffReason[] {
  const reasons: HandoffReason[] = [];
  if (input.userAskedForHuman) reasons.push("pedido_do_funcionario");
  if (input.priority === "critica") reasons.push("caso_critico");
  if (input.ticketOverdue === true) reasons.push("chamado_vencido");
  if (input.confidence < CONFIDENCE_THRESHOLD) reasons.push("baixa_confianca");
  return reasons;
}
