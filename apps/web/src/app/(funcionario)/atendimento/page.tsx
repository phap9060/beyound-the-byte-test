import type { Metadata } from "next";

import { Composer } from "@/components/employee/composer";
import { StatusPill, TopBar } from "@/components/employee/top-bar";
import { countSessionMessages } from "@/server/conversations";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Atendimento · Nexo Assist" };

export default async function AtendimentoPage() {
  const user = await requireUser("funcionario");
  const used = await countSessionMessages(user.sessionId);
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <>
      <TopBar title="Atendimento">
        <StatusPill tone="success">Assistente online</StatusPill>
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col">
        <section
          aria-label="Conversa"
          className="flex flex-1 flex-col justify-end overflow-y-auto px-4 pt-7 pb-1 md:px-10"
        >
          <div className="mx-auto w-full max-w-[808px] pb-6">
            <h1 className="font-display text-[28px] leading-tight tracking-[-0.4px] md:text-[34px]">
              Olá, {firstName}. Como posso ajudar?
            </h1>
            <p className="mt-2 max-w-[560px] text-[14.5px] leading-normal text-ink-3">
              Descreva o problema com suas palavras. Eu consulto seus chamados, busco na central de
              ajuda e chamo um analista quando precisar.
            </p>
          </div>
        </section>

        <div className="px-4 pt-2.5 pb-[18px] md:px-10">
          <div className="mx-auto w-full max-w-[808px]">
            <Composer used={used} disabledReason="O assistente será conectado em breve." />
          </div>
        </div>
      </div>
    </>
  );
}
