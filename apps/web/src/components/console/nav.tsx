"use client";

import { ListChecks, MessageCircle } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DECISIONS: Route = "/console/decisoes";

export function ConsoleNav({ waiting }: { waiting: number }) {
  const onDecisions = usePathname() === DECISIONS;
  const item = (active: boolean) =>
    `relative flex size-9 items-center justify-center rounded-[12px] md:size-10 ${
      active ? "bg-desk text-ink md:bg-paper" : "text-ink-3 hover:bg-desk md:hover:bg-paper"
    }`;

  return (
    <>
      <Link
        href="/console"
        title="Conversas"
        aria-current={onDecisions ? undefined : "page"}
        className={item(!onDecisions)}
      >
        <MessageCircle className="size-[19px]" aria-hidden />
        <span className="sr-only">Conversas</span>
        {waiting > 0 && (
          <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-desk bg-cta px-1 text-[10px] font-bold text-white">
            {waiting}
            <span className="sr-only"> aguardando atendente</span>
          </span>
        )}
      </Link>
      <Link
        href={DECISIONS}
        title="Decisões do agent"
        aria-current={onDecisions ? "page" : undefined}
        className={item(onDecisions)}
      >
        <ListChecks className="size-[19px]" aria-hidden />
        <span className="sr-only">Decisões do agent</span>
      </Link>
    </>
  );
}
