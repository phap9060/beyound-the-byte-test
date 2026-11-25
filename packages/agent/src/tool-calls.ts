import type { AgentToolCall } from "@nexo/domain";

export const MAX_LOGGED_CHARS = 2000;

interface ToolStep {
  toolCalls: { payload: { toolCallId: string; toolName: string; args?: unknown } }[];
  toolResults: { payload: { toolCallId: string; result: unknown } }[];
}

function clip(text: string): string {
  return text.length > MAX_LOGGED_CHARS ? `${text.slice(0, MAX_LOGGED_CHARS)}…` : text;
}

function serialize(value: unknown): string {
  return clip(JSON.stringify(value ?? null));
}

function failed(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  return "erro" in result || ("error" in result && result.error === true);
}

function splitWhy(args: unknown): { why?: string; rest: unknown } {
  if (typeof args !== "object" || args === null || !("porque" in args)) return { rest: args };
  const { porque, ...rest } = args;
  return typeof porque === "string" ? { why: clip(porque), rest } : { rest: args };
}

export function toToolCalls(step: ToolStep): AgentToolCall[] {
  return step.toolCalls.map(({ payload: call }) => {
    const found = step.toolResults.find((r) => r.payload.toolCallId === call.toolCallId);
    const { why, rest } = splitWhy(call.args);
    return {
      tool: call.toolName,
      status: found && failed(found.payload.result) ? "failed" : "done",
      ...(why ? { why } : {}),
      args: serialize(rest),
      ...(found ? { result: serialize(found.payload.result) } : {}),
    };
  });
}
