import { Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { formatListTime } from "@/lib/format";
import { listConsole } from "@/server/conversations";
import type { ConsoleFilter, ConsoleItem } from "@/server/conversations";

import { Avatar } from "./avatar";
import { TONE_DOT, TONE_TEXT, statusTag } from "./status";

const FILTERS: { value: ConsoleFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "para-voce", label: "Para você" },
  { value: "agent", label: "Com o agent" },
  { value: "minhas", label: "Minhas" },
];

export function parseFilter(value: string | string[] | undefined): ConsoleFilter {
  return FILTERS.some((f) => f.value === value) ? (value as ConsoleFilter) : "todas";
}

function href(path: string, filter: ConsoleFilter, q: string): Route {
  const params = new URLSearchParams();
  if (filter !== "todas") params.set("filtro", filter);
  if (q) params.set("q", q);
  const qs = params.toString();
  return (qs ? `${path}?${qs}` : path) as Route;
}

function preview(item: ConsoleItem, analystId: string): string {
  const m = item.lastMessage;
  if (!m) return "";
  if (m.author === "agent") return `Nexo: ${m.text}`;
  if (m.author === "analyst") {
    return m.authorId === analystId ? `Você: ${m.text}` : m.text;
  }
  return m.text;
}

interface Props {
  analystId: string;
  filter: ConsoleFilter;
  query: string;
  selectedId?: string | undefined;
  className?: string;
}

export async function ConversationList({ analystId, filter, query, selectedId, className }: Props) {
  const { items, counts } = await listConsole(analystId, filter, query);
  const now = new Date();

  return (
    <section
      aria-label="Conversas"
      className={`flex min-h-0 w-full flex-col border-r border-rule bg-paper lg:w-[380px] lg:shrink-0 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-3 px-4 pt-4 pb-2.5">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-[20px] font-bold">Conversas</h1>
          <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-[5px] text-[12.5px] font-semibold text-success-text">
            <span className="size-[7px] rounded-full bg-success" aria-hidden />
            Disponível
          </span>
        </div>

        <form role="search" action="/console" className="relative">
          {filter !== "todas" && <input type="hidden" name="filtro" value={filter} />}
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <label htmlFor="console-search" className="sr-only">
            Pesquisar conversa ou chamado
          </label>
          <input
            id="console-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Pesquisar conversa ou chamado"
            className="h-9 w-full rounded-full bg-desk pr-3 pl-9 text-[13.5px] outline-none placeholder:text-ink-3 focus:ring-3 focus:ring-cta/15"
          />
        </form>

        <nav aria-label="Filtros" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <Link
                key={f.value}
                href={href("/console", f.value, query)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-[9px] py-1.5 text-[12.5px] font-medium ${
                  active ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2 hover:bg-rule"
                }`}
              >
                {f.label}
                {f.value !== "todas" && (
                  <span className={`font-semibold ${active ? "" : "text-ink-3"}`}>
                    {counts[f.value]}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <ul className="flex-1 overflow-y-auto px-2 pb-2">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-[13.5px] text-ink-3">
            Nenhuma conversa {query ? `para "${query}"` : "neste filtro"}.
          </li>
        )}
        {items.map((item) => {
          const selected = item.id === selectedId;
          const tag = statusTag(item, analystId, now);
          const needsYou = item.status === "waiting_human";
          return (
            <li key={item.id}>
              <Link
                href={href(`/console/${item.id}`, filter, query)}
                aria-current={selected ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[12px] p-2.5 ${selected ? "bg-desk" : "hover:bg-desk/60"}`}
              >
                <Avatar name={item.employeeName} size="lg" />
                <span className="flex min-w-0 flex-1 flex-col gap-[3px] border-b border-rule pb-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex-1 truncate text-[15.5px] ${needsYou ? "font-semibold" : "font-medium"}`}
                    >
                      {item.employeeName}
                    </span>
                    <span
                      className={`text-[12.5px] ${needsYou ? "font-semibold text-cta" : "text-ink-3"}`}
                    >
                      {formatListTime(item.lastMessageAt, now)}
                    </span>
                  </span>
                  <span className="truncate text-[13.5px] text-ink-3">
                    {preview(item, analystId)}
                  </span>
                  <span
                    className={`flex items-center gap-[5px] text-[11.5px] font-medium ${TONE_TEXT[tag.tone]}`}
                  >
                    <span className={`size-1.5 rounded-full ${TONE_DOT[tag.tone]}`} aria-hidden />
                    {tag.label}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
