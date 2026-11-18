import type { Affected, Priority, TicketType } from "./ticket.ts";

// O LLM só extrai os fatos da conversa; a prioridade é decidida aqui (Anexo A).
export interface PriorityInput {
  type: TicketType;
  affected: Affected;
  blocksWork: boolean;
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
