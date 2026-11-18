import { describe, expect, it } from "vitest";

import { canReopen, reopenEligibility } from "./reopen.ts";

const d = (iso: string) => new Date(iso);
const now = d("2026-11-18T13:00:00Z");

describe("reopenEligibility", () => {
  it("resolvido há 4 dias pode ser reaberto (o INC-20150 do Anexo B)", () => {
    const ticket = { status: "resolvido", resolvedAt: d("2026-11-14T13:00:00Z") } as const;
    expect(reopenEligibility(ticket, now)).toEqual({ eligible: true });
  });

  it("resolvido há exatamente 7 dias ainda pode", () => {
    const ticket = { status: "resolvido", resolvedAt: d("2026-11-11T13:00:00Z") } as const;
    expect(canReopen(ticket, now)).toBe(true);
  });

  it("resolvido há mais de 7 dias não pode", () => {
    const ticket = { status: "resolvido", resolvedAt: d("2026-11-11T12:59:00Z") } as const;
    expect(reopenEligibility(ticket, now)).toEqual({
      eligible: false,
      reason: "janela_expirada",
    });
  });

  it("chamado aberto não é reaberto: ele deve ser atualizado", () => {
    expect(reopenEligibility({ status: "em_andamento" }, now)).toEqual({
      eligible: false,
      reason: "nao_resolvido",
    });
  });

  it("chamado cancelado não pode ser reaberto", () => {
    const ticket = { status: "cancelado", resolvedAt: d("2026-11-17T13:00:00Z") } as const;
    expect(canReopen(ticket, now)).toBe(false);
  });
});
