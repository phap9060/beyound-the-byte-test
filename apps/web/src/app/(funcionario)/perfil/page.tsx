import { KeyRound, Lock } from "lucide-react";
import type { Metadata } from "next";

import { TopBar } from "@/components/employee/top-bar";
import { requireUser } from "@/server/session";

import { ResetPassword } from "./reset-password";

export const metadata: Metadata = { title: "Meu perfil · Nexo Assist" };

const card = "rounded-2xl border border-ink/9 bg-paper";
const row = "flex flex-col gap-1 px-6 py-5 sm:flex-row sm:items-center sm:gap-4";
const key = "w-40 shrink-0 text-[13.5px] text-ink-3";

export default async function PerfilPage() {
  const user = await requireUser("funcionario");

  return (
    <>
      <TopBar title="Meu perfil" />
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-10 md:py-12">
        <div className="mx-auto flex w-full max-w-[600px] flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[24px] font-bold tracking-[-0.4px]">Meu perfil</h1>
            <p className="text-[14.5px] text-ink-3">Seus dados de acesso ao service desk de TI.</p>
          </div>

          <dl className={card}>
            <div className={`${row} border-b border-rule`}>
              <dt className={key}>Nome</dt>
              <dd className="text-[14.5px] font-medium">{user.name}</dd>
            </div>
            <div className={`${row} border-b border-rule`}>
              <dt className={key}>Área</dt>
              <dd className="text-[14.5px] font-medium">{user.department}</dd>
            </div>
            <div className={row}>
              <dt className={key}>E-mail corporativo</dt>
              <dd className="flex flex-1 flex-wrap items-center justify-between gap-2">
                <span className="text-[14.5px] font-medium break-all">{user.email}</span>
                <span className="flex items-center gap-[5px] text-[12.5px] text-ink-3">
                  <Lock className="size-[13px]" aria-hidden />
                  Gerenciado pela TI
                </span>
              </dd>
            </div>
          </dl>

          <section aria-label="Senha" className={`${card} overflow-hidden`}>
            <div className="grid grid-cols-[auto_1fr] items-center gap-4 p-6 sm:grid-cols-[auto_1fr_auto]">
              <span className="flex size-10 items-center justify-center rounded-full bg-desk">
                <KeyRound className="size-[18px] text-ink-2" aria-hidden />
              </span>
              <div className="flex flex-col gap-[3px]">
                <h2 className="text-[14.5px] font-semibold">Senha</h2>
                <p className="text-[13.5px] text-ink-3">A mesma da rede Nexo</p>
              </div>
              <ResetPassword email={user.email} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
