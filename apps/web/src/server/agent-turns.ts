import "server-only";

import {
  AgentStepSchema,
  AgentToolCallSchema,
  AgentTraceSchema,
  CONFIDENCE_THRESHOLD,
  PrioritySchema,
} from "@nexo/domain";
import type { AgentTurnOutcome } from "@nexo/domain";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "./db/client";
import { agentTurns, conversations, messages } from "./db/schema";

export const TURN_FILTERS = ["todas", "baixa-confianca", "transferidas", "sem-resposta"] as const;
export type TurnFilter = (typeof TURN_FILTERS)[number];

export const TURNS_LIMIT = 100;

const UNANSWERED: AgentTurnOutcome[] = [
  "discarded",
  "model_error",
  "rate_limited",
  "not_configured",
];

const CONDITIONS: Record<TurnFilter, SQL | undefined> = {
  todas: undefined,
  "baixa-confianca": lt(agentTurns.confidence, CONFIDENCE_THRESHOLD),
  transferidas: eq(agentTurns.outcome, "handed_off"),
  "sem-resposta": inArray(agentTurns.outcome, UNANSWERED),
};

const StepsSchema = z.array(AgentStepSchema);
const ToolCallsSchema = z.array(AgentToolCallSchema);
const PriorityDecisionSchema = z.object({
  priority: PrioritySchema,
  rule: z.string(),
  reason: z.string(),
});

export async function listTurns(filter: TurnFilter) {
  const db = await getDb();
  const rows = await db
    .select({
      turn: agentTurns,
      employeeName: conversations.employeeName,
      message: messages.text,
    })
    .from(agentTurns)
    .innerJoin(conversations, eq(conversations.id, agentTurns.conversationId))
    .innerJoin(messages, eq(messages.id, agentTurns.employeeMessageId))
    .where(and(CONDITIONS[filter]))
    .orderBy(desc(agentTurns.id))
    .limit(TURNS_LIMIT);

  return rows.map(({ turn, employeeName, message }) => ({
    ...turn,
    employeeName,
    message,
    steps: StepsSchema.safeParse(turn.steps).data ?? [],
    toolCalls: ToolCallsSchema.safeParse(turn.toolCalls).data ?? [],
    priority: PriorityDecisionSchema.safeParse(turn.priority).data ?? null,
    trace: AgentTraceSchema.safeParse(turn.trace).data ?? null,
  }));
}

export type TurnItem = Awaited<ReturnType<typeof listTurns>>[number];

export async function countTurns(): Promise<Record<TurnFilter, number>> {
  const db = await getDb();
  const total = (condition: SQL | undefined) =>
    sql<number>`count(case when ${condition ?? sql`1`} then 1 end)`;
  const [row] = await db
    .select({
      todas: total(CONDITIONS.todas),
      "baixa-confianca": total(CONDITIONS["baixa-confianca"]),
      transferidas: total(CONDITIONS.transferidas),
      "sem-resposta": total(CONDITIONS["sem-resposta"]),
    })
    .from(agentTurns);
  return row ?? { todas: 0, "baixa-confianca": 0, transferidas: 0, "sem-resposta": 0 };
}
