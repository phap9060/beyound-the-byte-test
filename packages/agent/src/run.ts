import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { HANDOFF_REASON_LABEL, err, evaluateHandoff, ok } from "@nexo/domain";
import type {
  AgentDecision,
  AgentStep,
  AgentToolCall,
  HandoffReason,
  MessagePart,
  PriorityDecision,
  Result,
} from "@nexo/domain";

import { toModelMessages } from "./history.ts";
import type { HistoryItem } from "./history.ts";
import { buildInstructions } from "./instructions.ts";
import { createRecorder } from "./recorder.ts";
import type { TurnRecorder } from "./recorder.ts";
import { REPLY_TOOL, ReplySchema, replyTool } from "./reply.ts";
import type { Reply } from "./reply.ts";
import { toToolCalls } from "./tool-calls.ts";
import { createTools } from "./tools.ts";
import type { AgentTicketClient } from "./tools.ts";

export const MAX_STEPS = 6;
const TURN_TIMEOUT_MS = 45_000;

export interface AgentTurnInput {
  model: MastraModelConfig;
  client: AgentTicketClient;
  employee: { id: string; name: string };
  history: HistoryItem[];
  message: string;
  now?: Date;
  signal?: AbortSignal;
}

export interface AgentHandoff {
  reasons: HandoffReason[];
  summary: string;
  ticketId?: string;
}

export interface AgentTurn {
  text: string;
  parts: MessagePart[];
  steps: AgentStep[];
  toolCalls: AgentToolCall[];
  decision: AgentDecision;
  handoff?: AgentHandoff;
  priority?: PriorityDecision;
  usage: { inputTokens: number; outputTokens: number; modelCalls: number };
  durationMs: number;
}

export interface AgentError {
  kind: "model_error";
  message: string;
  steps: AgentStep[];
  toolCalls: AgentToolCall[];
  durationMs: number;
}

const LOW_CONFIDENCE_NOTE =
  "Para não arriscar uma resposta errada, chamei um analista, que vai continuar com você por aqui.";

export async function runAgentTurn(input: AgentTurnInput): Promise<Result<AgentTurn, AgentError>> {
  const startedAt = Date.now();
  const now = input.now ?? new Date();
  const recorder = createRecorder();
  const toolCalls: AgentToolCall[] = [];

  const agent = new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    instructions: buildInstructions(input.employee, now),
    model: input.model,
    tools: {
      ...createTools({ employeeId: input.employee.id, client: input.client, now, recorder }),
      [REPLY_TOOL]: replyTool,
    },
  });

  const messages = [
    ...toModelMessages(input.history),
    { role: "user" as const, content: input.message },
  ];

  let output;
  try {
    output = await agent.generate(messages, {
      maxSteps: MAX_STEPS,
      toolChoice: "required",
      abortSignal: input.signal ?? AbortSignal.timeout(TURN_TIMEOUT_MS),
      modelSettings: { maxRetries: 2 },
      onStepFinish: (step) => {
        toolCalls.push(...toToolCalls(step));
      },
    });
  } catch (error) {
    return err({
      kind: "model_error",
      message: error instanceof Error ? error.message : String(error),
      steps: recorder.steps,
      toolCalls,
      durationMs: Date.now() - startedAt,
    });
  }

  const replyCall = output.toolCalls.findLast((c) => c.payload.toolName === REPLY_TOOL);
  const reply = replyCall ? parseReply(replyCall.payload.args, recorder) : fallbackReply();

  return ok({
    ...assemble(reply, recorder),
    toolCalls,
    usage: {
      inputTokens: sum(output.steps.map((s) => s.usage.inputTokens)),
      outputTokens: sum(output.steps.map((s) => s.usage.outputTokens)),
      modelCalls: output.steps.length,
    },
    durationMs: Date.now() - startedAt,
  });
}

function sum(values: (number | undefined)[]): number {
  return values.reduce<number>((total, v) => total + (v ?? 0), 0);
}

// Um campo opcional fora do formato (ex.: uma opção só) não pode jogar fora a resposta inteira:
// descarta o campo e registra o motivo. Só sem mensagem ou confiança vale a contingência.
const CoreReplySchema = ReplySchema.omit({ opcoes: true, mostrarChamados: true });

function parseReply(args: unknown, recorder: TurnRecorder): Reply {
  const strict = ReplySchema.safeParse(args);
  if (strict.success) return strict.data;

  const issues = strict.error.issues.map((i) => i.path.join(".") || i.message).join(", ");
  const core = CoreReplySchema.safeParse(args);
  if (core.success) {
    recorder.step("ajustou a resposta", "failed", `campo fora do formato descartado: ${issues}`);
    return core.data;
  }
  return fallbackReply(`O modelo respondeu fora do formato esperado (${issues}).`);
}

function fallbackReply(
  reason = `O modelo não concluiu a resposta em ${String(MAX_STEPS)} passos.`,
): Reply {
  return {
    mensagem: "Desculpe, não consegui concluir a sua solicitação.",
    intencao: "conversa",
    entendimento: "Não foi possível interpretar o pedido.",
    confianca: 0,
    motivo: reason,
  };
}

function assemble(reply: Reply, recorder: TurnRecorder) {
  const reasons = new Set<HandoffReason>(
    evaluateHandoff({
      userAskedForHuman: reply.intencao === "falar_com_analista",
      confidence: reply.confianca,
    }),
  );
  if (recorder.handoff) reasons.add(recorder.handoff.reason);

  let text = reply.mensagem;
  if (reasons.size > 0 && !recorder.handoff) {
    // O próprio modelo não transferiu, mas a regra manda transferir (pedido ou baixa confiança).
    recorder.step(
      "transferiu para um analista",
      "done",
      [...reasons].map((r) => HANDOFF_REASON_LABEL[r]).join(" · "),
    );
    if (reasons.has("baixa_confianca")) text = `${text}\n\n${LOW_CONFIDENCE_NOTE}`;
  }

  const handoff: AgentHandoff | undefined =
    reasons.size > 0
      ? {
          reasons: [...reasons],
          summary: recorder.handoff?.summary ?? reply.entendimento,
          ...(recorder.handoff?.ticketId ? { ticketId: recorder.handoff.ticketId } : {}),
        }
      : undefined;

  const parts = buildParts(reply, recorder, handoff !== undefined);

  const decision: AgentDecision = {
    intent: reply.intencao,
    understood: reply.entendimento,
    action: describeAction(parts, handoff),
    confidence: reply.confianca,
    reason: reply.motivo,
  };

  return {
    text,
    parts,
    steps: recorder.steps,
    decision,
    ...(handoff ? { handoff } : {}),
    ...(recorder.priority ? { priority: recorder.priority } : {}),
  };
}

// Os cards saem do que as ferramentas buscaram neste turno, nunca do texto do modelo:
// assim ele não consegue mostrar um chamado inventado ou de outra pessoa.
function buildParts(reply: Reply, recorder: TurnRecorder, handedOff: boolean): MessagePart[] {
  const parts: MessagePart[] = [];
  // Também entram os chamados citados no texto: o modelo às vezes fala de um e esquece o card.
  const mentioned = reply.mensagem.match(/\b(?:INC|REQ)-\d{4,}\b/g) ?? [];
  const shown = [...new Set([...(reply.mostrarChamados ?? []), ...mentioned])].flatMap((id) => {
    const view = recorder.seen.get(id);
    return view ? [view] : [];
  });
  const [single] = shown;
  if (shown.length === 1 && single) parts.push({ type: "ticket_card", ticket: single });
  if (shown.length > 1) parts.push({ type: "ticket_list", tickets: shown });

  parts.push(...recorder.proposals);

  if (reply.opcoes && !handedOff) {
    parts.push({
      type: "quick_options",
      ...(reply.opcoes.pergunta ? { question: reply.opcoes.pergunta } : {}),
      numbered: reply.opcoes.numeradas,
      options: reply.opcoes.itens.map((label, i) => ({ value: String(i + 1), label })),
    });
  }
  return parts;
}

function describeAction(parts: MessagePart[], handoff: AgentHandoff | undefined): string {
  if (handoff) return "Transferiu a conversa para um analista";
  const proposal = parts.find((p) => p.type === "draft" || p.type === "update_draft");
  if (proposal?.type === "draft") return "Mostrou um rascunho de chamado para confirmação";
  if (proposal?.type === "update_draft") {
    return proposal.action === "reabrir"
      ? `Propôs reabrir o ${proposal.ticketId}`
      : `Propôs complementar o ${proposal.ticketId}`;
  }
  if (parts.some((p) => p.type === "quick_options")) return "Fez uma pergunta com opções";
  if (parts.some((p) => p.type === "ticket_list")) return "Mostrou os chamados para escolher";
  if (parts.some((p) => p.type === "ticket_card")) return "Mostrou o chamado";
  return "Respondeu";
}
