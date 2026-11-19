import type { ConversationRow } from "@/server/conversations";
import { formatTime } from "@/lib/format";

export type Tone = "danger" | "warning" | "primary" | "violet" | "success" | "muted";

export const TONE_TEXT: Record<Tone, string> = {
  danger: "text-danger-text",
  warning: "text-warning-text",
  primary: "text-primary-text",
  violet: "text-violet-text",
  success: "text-success-text",
  muted: "text-ink-3",
};

export const TONE_DOT: Record<Tone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  primary: "bg-primary",
  violet: "bg-violet",
  success: "bg-success",
  muted: "bg-ink-3",
};

export const TONE_SOFT: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger-text",
  warning: "bg-warning-soft text-warning-text",
  primary: "bg-primary-soft text-primary-text",
  violet: "bg-violet-soft text-violet-text",
  success: "bg-success-soft text-success-text",
  muted: "bg-desk text-ink-3",
};

function minutesUntil(date: Date, now: Date): number {
  return Math.round((date.getTime() - now.getTime()) / 60_000);
}

export function statusTag(c: ConversationRow, analystId: string, now: Date) {
  switch (c.status) {
    case "waiting_human": {
      if (c.handoffReasons?.includes("baixa_confianca") && c.agentConfidence !== null) {
        const pct = Math.round(c.agentConfidence * 100);
        return { tone: "warning" as Tone, label: `Agent pediu ajuda · confiança ${String(pct)}%` };
      }
      if (c.linkedTicketId)
        return { tone: "danger" as Tone, label: `Transferida · ${c.linkedTicketId}` };
      if (c.waitingUntil) {
        const m = minutesUntil(c.waitingUntil, now);
        return {
          tone: "danger" as Tone,
          label:
            m > 0 ? `Transferida · contato em ${String(m)} min` : "Transferida · prazo vencido",
        };
      }
      return { tone: "danger" as Tone, label: "Transferida" };
    }
    case "human":
      return c.assignedAnalystId === analystId
        ? { tone: "primary" as Tone, label: "Você está atendendo" }
        : { tone: "primary" as Tone, label: `Com ${c.assignedAnalystName ?? "um analista"}` };
    case "agent":
      return { tone: "violet" as Tone, label: "Agent atendendo" };
    case "closed":
      return c.closedBy === "agent"
        ? { tone: "success" as Tone, label: "Resolvida pelo agent" }
        : { tone: "muted" as Tone, label: "Encerrada" };
  }
}

export function waitingText(c: ConversationRow, now: Date): string {
  if (!c.waitingUntil) return "Agent pausado";
  return c.waitingUntil.getTime() > now.getTime()
    ? `Agent pausado · até ${formatTime(c.waitingUntil.toISOString())}`
    : "Agent pausado · prazo para assumir vencido";
}
