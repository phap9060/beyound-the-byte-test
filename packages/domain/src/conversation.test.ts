import { describe, expect, it } from "vitest";

import { agentCanReply, handoffDeadline, transitionConversation } from "./conversation.ts";

describe("transitionConversation", () => {
  it.each([
    ["agent", "handoff", "waiting_human"],
    ["waiting_human", "assume", "human"],
    ["agent", "assume", "human"],
    ["human", "return_to_agent", "agent"],
    ["waiting_human", "return_to_agent", "agent"],
    ["human", "close_by_analyst", "closed"],
    ["waiting_human", "close_by_analyst", "closed"],
    ["agent", "close_by_agent", "closed"],
    ["closed", "employee_writes", "agent"],
  ] as const)("%s + %s → %s", (from, action, to) => {
    expect(transitionConversation(from, action)).toEqual({ ok: true, value: to });
  });

  it.each([
    ["human", "handoff"],
    ["closed", "assume"],
    ["agent", "return_to_agent"],
    ["agent", "close_by_analyst"],
    ["human", "close_by_agent"],
    ["human", "employee_writes"],
  ] as const)("recusa %s + %s", (from, action) => {
    expect(transitionConversation(from, action)).toEqual({ ok: false, error: { from, action } });
  });
});

describe("agentCanReply", () => {
  it("o agent só responde quando a conversa está com ele", () => {
    expect(agentCanReply("agent")).toBe(true);
    expect(agentCanReply("waiting_human")).toBe(false);
    expect(agentCanReply("human")).toBe(false);
    expect(agentCanReply("closed")).toBe(false);
  });
});

describe("handoffDeadline", () => {
  it("2 horas úteis para casos comuns (o 10:05 → 12:05 do protótipo)", () => {
    // quarta 10:05 → quarta 12:05
    expect(handoffDeadline(new Date("2026-11-18T13:05:00Z"))).toEqual(
      new Date("2026-11-18T15:05:00Z"),
    );
  });

  it("1 hora corrida para casos críticos, mesmo fora do expediente", () => {
    // sábado 03:00 → sábado 04:00
    expect(handoffDeadline(new Date("2026-11-21T06:00:00Z"), "critica")).toEqual(
      new Date("2026-11-21T07:00:00Z"),
    );
  });
});
