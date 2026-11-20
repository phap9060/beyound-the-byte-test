import { PRIORITY_LABEL } from "@nexo/domain";
import type { AgentStep, MessageAuthor, MessagePart } from "@nexo/domain";

export interface HistoryItem {
  author: MessageAuthor;
  authorName: string | null;
  text: string;
  parts: MessagePart[];
  steps: AgentStep[];
}

export type ModelMessage =
  { role: "user"; content: string } | { role: "assistant"; content: string };

// Custo: só as últimas mensagens vão para o modelo; o resto já foi resolvido ou está nos chamados.
export const HISTORY_LIMIT = 20;

const STATE_LABEL = {
  pending: "aguardando confirmação",
  confirmed: "confirmado",
  cancelled: "cancelado",
} as const;

function describePart(part: MessagePart): string {
  switch (part.type) {
    case "text":
      return part.text;
    case "quick_options":
      return `[Opções oferecidas: ${part.options.map((o) => o.label).join(" | ")}]`;
    case "ticket_list":
      return `[Mostrou os chamados: ${part.tickets.map((t) => `${t.id} (${t.title})`).join(", ")}]`;
    case "ticket_card":
      return `[Mostrou o chamado ${part.ticket.id} (${part.ticket.title})]`;
    case "draft": {
      const created = part.ticketId ? `, criado como ${part.ticketId}` : "";
      return `[Rascunho ${part.draft.type} "${part.draft.title}", prioridade ${PRIORITY_LABEL[part.draft.priority]}: ${STATE_LABEL[part.state]}${created}]`;
    }
    case "update_draft": {
      const what = part.action === "reabrir" ? "Reabertura" : "Complemento";
      return `[${what} do ${part.ticketId}: "${part.message}": ${STATE_LABEL[part.state]}]`;
    }
  }
}

// O que o agent já consultou vai junto, para ele não repetir as mesmas chamadas a cada turno.
function describeSteps(steps: AgentStep[]): string[] {
  if (steps.length === 0) return [];
  const done = steps.map(
    (s) =>
      `${s.label}${s.detail ? ` (${s.detail})` : ""}${s.status === "failed" ? " [falhou]" : ""}`,
  );
  return [`[Ações: ${done.join("; ")}]`];
}

function toContent(item: HistoryItem): string {
  return [...describeSteps(item.steps), item.text, ...item.parts.map(describePart)]
    .filter((s) => s.length > 0)
    .join("\n");
}

export function toModelMessages(history: HistoryItem[]): ModelMessage[] {
  const messages = history.slice(-HISTORY_LIMIT).flatMap((item): ModelMessage[] => {
    const content = toContent(item);
    if (content.length === 0) return [];
    switch (item.author) {
      case "employee":
        return [{ role: "user", content }];
      case "agent":
        return [{ role: "assistant", content }];
      case "analyst":
        return [{ role: "assistant", content: `[Analista ${item.authorName ?? ""}]: ${content}` }];
      case "system":
        return [{ role: "assistant", content: `[Registro do sistema: ${content}]` }];
    }
  });
  const firstUser = messages.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : messages.slice(firstUser);
}
