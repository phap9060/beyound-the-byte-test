import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { ConversationList, parseFilter } from "@/components/console/conversation-list";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Conversas · Nexo Assist" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConsolePage({ searchParams }: Props) {
  const analyst = await requireUser("analista");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";

  return (
    <>
      <ConversationList analystId={analyst.id} filter={parseFilter(params.filtro)} query={q} />
      <div className="hidden flex-1 flex-col items-center justify-center gap-2 bg-thread text-center lg:flex">
        <MessageCircle className="size-8 text-ink-3" aria-hidden />
        <p className="text-[15.5px] font-semibold">Selecione uma conversa</p>
        <p className="max-w-[300px] text-[13.5px] text-ink-3">
          As que precisam de você estão no filtro &quot;Para você&quot;.
        </p>
      </div>
    </>
  );
}
