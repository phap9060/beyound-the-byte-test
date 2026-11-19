import { CATEGORY_LABEL } from "@nexo/domain";
import type { Category, Priority, TicketStatus } from "@nexo/domain";

const TZ = "America/Sao_Paulo";

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

// "16 de out." → "16 out"
export function formatDay(iso: string): string {
  return dayMonth.format(new Date(iso)).replace(" de ", " ").replace(".", "");
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

export function formatDayTime(iso: string): string {
  return `${formatDay(iso)}, ${formatTime(iso)}`;
}

export function formatAgo(iso: string, now: Date): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${String(minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${String(hours)} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${String(days)} dias`;
}

export function categoryLabel(category: Category, subcategory?: string): string {
  return subcategory ? `${CATEGORY_LABEL[category]} › ${subcategory}` : CATEGORY_LABEL[category];
}

export const STATUS_DOT: Record<TicketStatus, string> = {
  aguardando_analista: "bg-warning",
  em_andamento: "bg-primary",
  aprovado: "bg-success",
  resolvido: "bg-success",
  cancelado: "bg-ink-3",
};

export const STATUS_TEXT: Record<TicketStatus, string> = {
  aguardando_analista: "text-warning-text",
  em_andamento: "text-primary-text",
  aprovado: "text-success-text",
  resolvido: "text-success-text",
  cancelado: "text-ink-3",
};

export const PRIORITY_DOT: Record<Priority, string> = {
  critica: "bg-danger",
  alta: "bg-warning",
  media: "bg-ink/40",
  baixa: "bg-ink/20",
};
