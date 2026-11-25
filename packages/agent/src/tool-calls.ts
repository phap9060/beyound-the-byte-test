import type { AgentToolCall } from "@nexo/domain";

export const MAX_LOGGED_CHARS = 2000;

interface ToolStep {
  toolCalls: { payload: { toolCallId: string; toolName: string; args?: unknown } }[];
  toolResults: { payload: { toolCallId: string; result: unknown } }[];
}

function serialize(value: unknown): string {
  const text = JSON.stringify(value ?? null);
  return text.length > MAX_LOGGED_CHARS ? `${text.slice(0, MAX_LOGGED_CHARS)}…` : text;
}

function failed(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  return "erro" in result || ("error" in result && result.error === true);
}

export function toToolCalls(step: ToolStep): AgentToolCall[] {
  return step.toolCalls.map(({ payload: call }) => {
    const found = step.toolResults.find((r) => r.payload.toolCallId === call.toolCallId);
    return {
      tool: call.toolName,
      status: found && failed(found.payload.result) ? "failed" : "done",
      args: serialize(call.args),
      ...(found ? { result: serialize(found.payload.result) } : {}),
    };
  });
}
