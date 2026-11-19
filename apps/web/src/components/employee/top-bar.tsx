import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { MenuButton } from "./shell";

export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-rule px-4 md:h-16 md:px-8">
      <MenuButton />
      <nav
        aria-label="Você está em"
        className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px]"
      >
        <span className="hidden text-ink-3 sm:inline">Service desk de TI</span>
        <ChevronRight className="hidden size-3.5 text-ink-3 sm:block" aria-hidden />
        <span className="truncate font-semibold" aria-current="page">
          {title}
        </span>
      </nav>
      {children}
    </header>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning";
  children: ReactNode;
}) {
  const tones = {
    success: "bg-success-soft text-success-text",
    warning: "bg-warning-soft text-warning-text",
  };
  const dots = { success: "bg-success", warning: "bg-warning" };
  return (
    <span
      className={`flex shrink-0 items-center gap-[7px] rounded-full px-2.5 py-[5px] text-[12.5px] font-semibold ${tones[tone]}`}
    >
      <span className={`size-[7px] rounded-full ${dots[tone]}`} aria-hidden />
      {children}
    </span>
  );
}
