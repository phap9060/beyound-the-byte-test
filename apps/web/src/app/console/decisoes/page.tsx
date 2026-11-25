import type { Metadata, Route } from "next";
import Link from "next/link";

import { TurnDetails } from "@/components/console/turn-details";
import { TURNS_LIMIT, TURN_FILTERS, countTurns, listTurns } from "@/server/agent-turns";
import type { TurnFilter } from "@/server/agent-turns";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Decisões do agent · Nexo Assist" };

const FILTER_LABEL: Record<TurnFilter, string> = {
  todas: "Todas",
  "baixa-confianca": "Baixa confiança",
  transferidas: "Transferidas",
  "sem-resposta": "Sem resposta",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function href(filter: TurnFilter): Route {
  return filter === "todas" ? "/console/decisoes" : `/console/decisoes?filtro=${filter}`;
}

export default async function DecisionsPage({ searchParams }: Props) {
  await requireUser("analista");
  const { filtro } = await searchParams;
  const filter = TURN_FILTERS.find((f) => f === filtro) ?? "todas";
  const [turns, counts] = await Promise.all([listTurns(filter), countTurns()]);
  const now = new Date();

  return (
    <section
      aria-label="Decisões do agent"
      className="relative flex min-w-0 flex-1 flex-col overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4 px-4 py-5 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[20px] font-bold">Decisões do agent</h1>
          <p className="text-[13.5px] text-ink-3">
            Todos os turnos, com ou sem resposta. Mostrando até {TURNS_LIMIT}, do mais recente ao
            mais antigo.
          </p>
        </header>

        <nav aria-label="Filtros" className="flex flex-wrap gap-1">
          {TURN_FILTERS.map((f) => (
            <Link
              key={f}
              href={href(f)}
              aria-current={f === filter ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-[9px] py-1.5 text-[12.5px] font-medium ${
                f === filter
                  ? "bg-primary-soft text-primary-text"
                  : "bg-desk text-ink-2 hover:bg-rule"
              }`}
            >
              {FILTER_LABEL[f]}
              <span className={`font-semibold ${f === filter ? "" : "text-ink-3"}`}>
                {counts[f]}
              </span>
            </Link>
          ))}
        </nav>

        {turns.length === 0 ? (
          <p className="rounded-[12px] bg-desk px-4 py-10 text-center text-[13.5px] text-ink-3">
            Nenhuma decisão {filter === "todas" ? "registrada ainda" : "neste filtro"}.
          </p>
        ) : (
          <ol className="flex flex-col overflow-hidden rounded-[12px] border border-rule">
            {turns.map((turn) => (
              <li key={turn.id} className="border-b border-rule last:border-b-0">
                <TurnDetails turn={turn} now={now} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
