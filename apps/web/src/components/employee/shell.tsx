"use client";

import { initials } from "@nexo/domain";
import { LogOut, Menu, MessageSquare, UserRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { NexoMark } from "@/components/nexo-mark";

interface ShellUser {
  name: string;
  email: string;
}

const NAV: { href: Route; label: string; icon: LucideIcon }[] = [
  { href: "/atendimento", label: "Atendimento", icon: MessageSquare },
  { href: "/perfil", label: "Meu perfil", icon: UserRound },
];

const MenuContext = createContext<() => void>(() => undefined);

export function EmployeeShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <MenuContext.Provider
      value={() => {
        setOpen(true);
      }}
    >
      <div className="flex h-dvh bg-paper">
        {open && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => {
              setOpen(false);
            }}
            className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-rule bg-paper px-3.5 pt-5 pb-3.5 transition-transform md:static md:w-16 md:translate-x-0 md:px-3 xl:w-[232px] xl:px-3.5 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-2 md:justify-center xl:justify-start">
            <div className="flex items-center gap-2.5">
              <NexoMark className="h-[17px] w-5 text-primary" />
              <span className="text-[16px] font-bold tracking-[-0.2px] md:hidden xl:inline">
                Nexo Assist
              </span>
            </div>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => {
                setOpen(false);
              }}
              className="rounded-lg p-1.5 text-ink-3 hover:bg-desk md:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          <nav className="mt-[22px] flex flex-col gap-0.5" aria-label="Principal">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setOpen(false);
                  }}
                  className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] md:justify-center xl:justify-start ${
                    active
                      ? "bg-primary-soft font-semibold text-primary-text"
                      : "font-medium text-ink-2 hover:bg-desk"
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${active ? "" : "text-ink-3"}`} aria-hidden />
                  <span className="md:sr-only xl:not-sr-only">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center gap-2.5 border-t border-rule px-2 pt-3.5 pb-1 md:justify-center md:px-0 xl:justify-start xl:px-2">
            <span
              title={user.name}
              className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12.5px] font-bold text-primary-text"
            >
              {initials(user.name)}
            </span>
            <span className="flex min-w-0 flex-col gap-px md:hidden xl:flex">
              <span className="truncate text-[13.5px] font-semibold">{user.name}</span>
              <span className="truncate text-[11.5px] text-ink-3">{user.email}</span>
            </span>
          </div>

          <form action={logout} className="mt-1">
            <button
              type="submit"
              title="Sair"
              className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk md:justify-center xl:justify-start"
            >
              <LogOut className="size-4 shrink-0 text-ink-3" aria-hidden />
              <span className="md:sr-only xl:not-sr-only">Sair</span>
            </button>
          </form>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MenuContext.Provider>
  );
}

export function MenuButton() {
  const openMenu = useContext(MenuContext);
  return (
    <button
      type="button"
      aria-label="Abrir menu"
      onClick={openMenu}
      className="-ml-1.5 rounded-lg p-1.5 text-ink-2 hover:bg-desk md:hidden"
    >
      <Menu className="size-5" />
    </button>
  );
}
