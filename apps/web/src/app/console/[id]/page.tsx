import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConversationList, parseFilter } from "@/components/console/conversation-list";
import { ConversationView } from "@/components/console/conversation-view";
import { TicketPanel } from "@/components/console/ticket-panel";
import { getConversation } from "@/server/conversations";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Conversa · Nexo Assist" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function withParams(path: string, params: Record<string, string | undefined>): Route {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return (qs ? `${path}?${qs}` : path) as Route;
}

export default async function ConversationPage({ params, searchParams }: Props) {
  const analyst = await requireUser("analista");
  const { id } = await params;
  const sp = await searchParams;
  const filter = parseFilter(sp.filtro);
  const q = typeof sp.q === "string" ? sp.q : "";
  const panelOpen = sp.painel === "1";

  const data = await getConversation(id);
  if (!data) notFound();

  const keep = { filtro: filter === "todas" ? undefined : filter, q: q || undefined };
  const here = withParams(`/console/${id}`, keep);
  const firstName = data.conversation.employeeName.split(" ")[0] ?? "";

  const panel = (
    <Suspense fallback={<p className="p-5 text-[13.5px] text-ink-3">Carregando chamados…</p>}>
      <TicketPanel
        employeeId={data.conversation.employeeId}
        firstName={firstName}
        linkedTicketId={data.conversation.linkedTicketId}
        closeHref={here}
      />
    </Suspense>
  );

  return (
    <>
      <ConversationList
        analystId={analyst.id}
        filter={filter}
        query={q}
        selectedId={id}
        className="max-lg:hidden"
      />
      <ConversationView
        conversation={data.conversation}
        messages={data.messages}
        analystId={analyst.id}
        backHref={withParams("/console", keep)}
        panelHref={withParams(`/console/${id}`, { ...keep, painel: "1" })}
      />

      <aside
        aria-label={`Chamados de ${firstName}`}
        className="hidden w-[340px] shrink-0 flex-col border-l border-rule bg-paper xl:flex"
      >
        {panel}
      </aside>

      {panelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end xl:hidden">
          <Link href={here} aria-label="Fechar painel" className="absolute inset-0 bg-ink/40" />
          <aside
            aria-label={`Chamados de ${firstName}`}
            className="relative flex w-full max-w-[360px] flex-col bg-paper"
          >
            {panel}
          </aside>
        </div>
      )}
    </>
  );
}
