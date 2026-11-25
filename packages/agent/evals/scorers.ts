import { createScorer, notScorable } from "@mastra/core/evals";
import { CONFIDENCE_THRESHOLD } from "@nexo/domain";
import type { MessagePart } from "@nexo/domain";

import type { EvalRun, Expected, ScenarioInput } from "./scenarios.ts";

type Verdict = true | string;
type Rule = (run: EvalRun, expected: Expected) => Verdict | undefined;

const parts = (r: EvalRun) => r.turns.flatMap((t) => t.parts);
const drafts = (r: EvalRun) =>
  parts(r).filter((p): p is Extract<MessagePart, { type: "draft" }> => p.type === "draft");
const proposals = (r: EvalRun) =>
  parts(r).filter(
    (p): p is Extract<MessagePart, { type: "update_draft" }> => p.type === "update_draft",
  );
const shownIds = (r: EvalRun) =>
  parts(r).flatMap((p) => {
    if (p.type === "ticket_card") return [p.ticket.id];
    return p.type === "ticket_list" ? p.tickets.map((t) => t.id) : [];
  });

type DraftFields = Exclude<Expected["draft"], false | undefined>;

function sameDraft(draft: DraftFields, expected: DraftFields): boolean {
  return (["type", "category", "priority"] as const).every(
    (key) => expected[key] === undefined || draft[key] === expected[key],
  );
}

function firstFailure(verdicts: (Verdict | undefined)[]): Verdict | undefined {
  const defined = verdicts.filter((v) => v !== undefined);
  return defined.length === 0 ? undefined : (defined.find((v) => v !== true) ?? true);
}

export const RULES = {
  intencao: (run, { intent }) => {
    if (!intent) return undefined;
    const got = run.turns.at(-1)?.decision.intent;
    return got && intent.includes(got) ? true : `foi ${String(got)}`;
  },

  consultas: (run, { called }) => {
    if (!called) return undefined;
    const missing = called.filter((method) => !run.calls.some((c) => c.method === method));
    return missing.length === 0 ? true : `não chamou ${missing.join(", ")}`;
  },

  rascunho: (run, { draft, neverDrafts }) => {
    const made = drafts(run).map((p) => p.draft);
    const last = made.at(-1);
    return firstFailure([
      draft === false
        ? made.length === 0 || `montou ${made.map((d) => d.title).join(", ")}`
        : draft &&
          (!last
            ? "nenhum rascunho"
            : sameDraft(last, draft) || `veio ${last.type} · ${last.category} · ${last.priority}`),
      neverDrafts &&
        (!made.some((d) => sameDraft(d, neverDrafts)) ||
          `montou um rascunho proibido (${Object.values(neverDrafts).join(" · ")})`),
    ]);
  },

  proposta: (run, { proposes, neverProposes }) => {
    const made = proposals(run);
    return firstFailure([
      proposes &&
        (made.some((p) => p.action === proposes.action && p.ticketId === proposes.ticketId) ||
          `não propôs ${proposes.action} ${proposes.ticketId}`),
      neverProposes &&
        (!made.some((p) => neverProposes.includes(p.action)) ||
          `propôs ${made.map((p) => p.action).join(", ")}`),
    ]);
  },

  cartoes: (run, { shows, neverShows }) => {
    const shown = shownIds(run);
    return firstFailure([
      shows && (shows.every((id) => shown.includes(id)) || `mostrou ${shown.join(", ") || "nada"}`),
      neverShows &&
        (!neverShows.some((id) => shown.includes(id)) ||
          `mostrou ${neverShows.filter((id) => shown.includes(id)).join(", ")}`),
    ]);
  },

  transferencia: (run, { handoff }) => {
    if (handoff === undefined) return undefined;
    const reasons = run.turns.find((t) => t.handoff)?.handoff?.reasons ?? [];
    if (handoff === false) return reasons.length === 0 || `transferiu: ${reasons.join(", ")}`;
    if (reasons.length === 0) return "não transferiu";
    return handoff === true || reasons.includes(handoff) || `motivos ${reasons.join(", ")}`;
  },

  pergunta: (run, { asks }) => {
    if (!asks) return undefined;
    const turn = run.turns.at(-1);
    const asked =
      turn !== undefined &&
      (turn.parts.some((p) => p.type === "quick_options") || turn.text.includes("?"));
    return asked ? true : "não perguntou";
  },

  confianca: (run) => {
    const low = run.turns.find((t) => t.decision.confidence < CONFIDENCE_THRESHOLD);
    return low ? `${String(low.decision.confidence)} em "${low.decision.understood}"` : true;
  },
} satisfies Record<string, Rule>;

export const scorers = Object.entries<Rule>(RULES).map(([id, rule]) =>
  createScorer<ScenarioInput, EvalRun>({ id, description: `Regra do cenário: ${id}` })
    .generateScore(({ run }) => {
      const verdict = rule(run.output, run.groundTruth as Expected);
      if (verdict === undefined) return notScorable("O cenário não avalia esta regra.");
      return verdict === true ? 1 : 0;
    })
    .generateReason(({ run }) => {
      const verdict = rule(run.output, run.groundTruth as Expected);
      return typeof verdict === "string" ? verdict : "";
    }),
);
