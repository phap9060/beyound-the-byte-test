import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NexoMark } from "@/components/nexo-mark";
import { getCurrentUser, homePathFor } from "@/server/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Nexo Assist" };

const STATS = [
  { value: "8 s", label: "primeira resposta, em média" },
  { value: "72%", label: "resolvidos sem fila" },
  { value: "6", label: "analistas online agora", live: true },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:flex-row">
      <Showcase />

      <main className="flex flex-1 flex-col justify-between gap-10 px-4 py-8 sm:px-14 lg:py-10">
        <p className="flex justify-end gap-1.5 text-[13.5px]">
          <span className="text-ink-3">Problema para entrar?</span>
          <a href="tel:4000" className="font-semibold text-primary-text hover:underline">
            Ligue no ramal 4000
          </a>
        </p>

        <div className="flex justify-center">
          <LoginForm />
        </div>

        <footer className="flex flex-wrap justify-between gap-2 text-[12.5px] text-ink-3">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </main>
    </div>
  );
}

function Showcase() {
  return (
    <aside className="flex flex-col justify-between gap-10 bg-ink px-4 py-6 text-white sm:px-16 lg:w-[55%] lg:max-w-[800px] lg:pt-10 lg:pb-12">
      <div className="flex items-center gap-2.5">
        <NexoMark className="h-5 w-6" />
        <span className="text-[17px] font-bold tracking-[-0.2px]">Nexo Assist</span>
      </div>

      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-[18px]">
          <p className="text-[13.5px] font-medium text-white/55">Service desk de TI da Nexo</p>
          <h2 className="font-display text-[34px] leading-[1.04] tracking-[-1.2px] lg:text-[54px]">
            Seu problema de TI, resolvido em uma conversa.
          </h2>
          <p className="hidden max-w-[520px] text-[16px] leading-[1.55] text-white/65 lg:block">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central
            de ajuda e chama um analista quando precisa.
          </p>
        </div>

        <ConversationPreview />
      </div>

      <dl className="hidden border-t border-white/10 pt-6 lg:flex">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className={`flex flex-1 flex-col gap-1.5 ${i > 0 ? "border-l border-white/10 pl-6" : ""}`}
          >
            <dd className="order-1 flex items-center gap-2 font-display text-[34px] tracking-[-0.6px]">
              {s.value}
              {s.live && <span className="size-2 rounded-full bg-success" aria-hidden />}
            </dd>
            <dt className="order-2 text-[13.5px] text-white/55">{s.label}</dt>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function ConversationPreview() {
  return (
    <div aria-hidden className="hidden pl-24 lg:block">
      <div className="flex w-[500px] max-w-full flex-col gap-2.5 rounded-2xl border border-white/8 bg-white/4 p-[18px]">
        <div className="flex justify-end">
          <p className="rounded-[12px_12px_4px_12px] bg-paper px-3.5 py-[9px] text-[13.5px] text-ink">
            Meu notebook não conecta na VPN. Erro 809.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="flex gap-1.5 text-[12.5px]">
            <span className="font-semibold text-white/80">Nexo Assist</span>
            <span className="text-white/45">consultou seus chamados · criou um chamado</span>
          </p>
          <p className="w-[380px] max-w-full rounded-[4px_12px_12px_12px] bg-white/8 px-3.5 py-2.5 text-[13.5px] leading-normal">
            Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.
          </p>
          <p className="flex w-fit items-center gap-2 rounded-[12px] bg-paper px-3 py-[7px] text-[12.5px]">
            <span className="size-[7px] rounded-full bg-warning" />
            <span className="font-semibold text-ink">INC-20517</span>
            <span className="text-ink-3">Rede e VPN · Alta · em até 4 h</span>
          </p>
        </div>
      </div>
    </div>
  );
}
