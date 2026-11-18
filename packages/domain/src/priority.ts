import type { Affected, Priority, TicketType } from "./ticket.ts";

/**
 * Classificação de prioridade (Anexo A): combina o impacto (quantas pessoas
 * são afetadas) com a urgência (se algo parou ou se há compromisso em risco).
 *
 * O LLM não escolhe a prioridade. Ele extrai os fatos da conversa (quem é
 * afetado, se impede o trabalho, se há compromisso hoje) e esta função decide.
 * Isso torna a decisão previsível, testável e explicável.
 */
export interface PriorityInput {
  type: TicketType;
  affected: Affected;
  /** Algo parou: a pessoa (ou o grupo) não consegue trabalhar. */
  blocksWork: boolean;
  /** Há um compromisso no mesmo dia que depende disso (reunião, entrega...). */
  sameDayDeadline: boolean;
}

export type PriorityRule =
  | "parado_para_grupo"
  | "impede_trabalho"
  | "compromisso_hoje"
  | "pedido_sem_urgencia"
  | "ha_alternativa";

export interface PriorityDecision {
  priority: Priority;
  rule: PriorityRule;
  /** Justificativa em linguagem natural, exibida no detalhe da decisão. */
  reason: string;
}

export function classifyPriority(input: PriorityInput): PriorityDecision {
  const { type, affected, blocksWork, sameDayDeadline } = input;

  if (blocksWork && affected !== "somente_eu") {
    const who = affected === "equipe" ? "uma equipe" : "a empresa";
    return {
      priority: "critica",
      rule: "parado_para_grupo",
      reason: `Algo parado para ${who}.`,
    };
  }

  if (blocksWork) {
    return {
      priority: "alta",
      rule: "impede_trabalho",
      reason: "Impede uma pessoa de trabalhar.",
    };
  }

  if (sameDayDeadline) {
    return {
      priority: "alta",
      rule: "compromisso_hoje",
      reason: "Há um compromisso no mesmo dia que depende disso.",
    };
  }

  if (type === "REQ") {
    return {
      priority: "baixa",
      rule: "pedido_sem_urgencia",
      reason: "Pedido sem urgência.",
    };
  }

  return {
    priority: "media",
    rule: "ha_alternativa",
    reason: "Atrapalha, mas há alternativa.",
  };
}
