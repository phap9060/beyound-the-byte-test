import { initials } from "@nexo/domain";
import { LogOut, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { NexoMark } from "@/components/nexo-mark";
import { listConsole } from "@/server/conversations";
import { requireUser } from "@/server/session";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const analyst = await requireUser("analista");
  const { counts } = await listConsole(analyst.id, "todas", "");
  const waiting = counts["para-voce"];

  return (
    <div className="flex h-dvh flex-col bg-paper md:flex-row">
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-rule px-4 md:hidden">
        <NexoMark className="h-4 w-[19px] text-primary" />
        <span className="flex-1 text-[15px] font-bold">Nexo Assist</span>
        <span className="text-[12.5px] text-ink-3">{analyst.name}</span>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Sair"
            className="rounded-lg p-1.5 text-ink-2 hover:bg-desk"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </header>

      <nav
        aria-label="Console"
        className="hidden w-16 shrink-0 flex-col items-center gap-1.5 border-r border-rule bg-desk py-4 md:flex"
      >
        <span className="flex size-10 items-center justify-center pb-2">
          <NexoMark className="h-[19px] w-[22px] text-primary" />
        </span>
        <span
          title="Conversas"
          className="relative flex size-10 items-center justify-center rounded-[12px] bg-paper text-ink"
        >
          <MessageCircle className="size-[19px]" aria-hidden />
          <span className="sr-only">Conversas</span>
          {waiting > 0 && (
            <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-desk bg-cta px-1 text-[10px] font-bold text-white">
              {waiting}
              <span className="sr-only"> aguardando atendente</span>
            </span>
          )}
        </span>
        <span className="flex-1" />
        <span
          title={`${analyst.name} · ${analyst.supportTeam ?? ""}`}
          className="relative flex size-9 items-center justify-center rounded-full bg-primary-soft text-[12.5px] font-bold text-primary-text"
        >
          {initials(analyst.name)}
          <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-desk bg-success" />
        </span>
        <form action={logout}>
          <button
            type="submit"
            title="Sair"
            aria-label="Sair"
            className="mt-1 flex size-9 items-center justify-center rounded-[12px] text-ink-3 hover:bg-paper"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}
