import { describe, expect, it } from "vitest";

import { CONFIDENCE_THRESHOLD, evaluateHandoff, handoffTeam } from "./handoff.ts";

describe("evaluateHandoff", () => {
  it("não transfere quando nada exige", () => {
    expect(
      evaluateHandoff({ userAskedForHuman: false, priority: "media", confidence: 0.9 }),
    ).toEqual([]);
  });

  it("transfere quando o funcionário pede", () => {
    expect(evaluateHandoff({ userAskedForHuman: true, confidence: 0.95 })).toEqual([
      "pedido_do_funcionario",
    ]);
  });

  it("transfere casos críticos", () => {
    expect(
      evaluateHandoff({ userAskedForHuman: false, priority: "critica", confidence: 0.9 }),
    ).toEqual(["caso_critico"]);
  });

  it("transfere chamados vencidos", () => {
    expect(
      evaluateHandoff({ userAskedForHuman: false, ticketOverdue: true, confidence: 0.9 }),
    ).toEqual(["chamado_vencido"]);
  });

  it("transfere quando a confiança está abaixo do limiar (o 41% do console)", () => {
    expect(evaluateHandoff({ userAskedForHuman: false, confidence: 0.41 })).toEqual([
      "baixa_confianca",
    ]);
  });

  it("confiança exatamente no limiar não transfere", () => {
    expect(evaluateHandoff({ userAskedForHuman: false, confidence: CONFIDENCE_THRESHOLD })).toEqual(
      [],
    );
  });

  it("acumula todos os motivos que se aplicam", () => {
    expect(
      evaluateHandoff({
        userAskedForHuman: true,
        priority: "critica",
        ticketOverdue: true,
        confidence: 0.3,
      }),
    ).toEqual(["pedido_do_funcionario", "caso_critico", "chamado_vencido", "baixa_confianca"]);
  });
});

describe("handoffTeam", () => {
  it("manda crítico e vencido para o N2 e o resto para o N1", () => {
    expect(handoffTeam(["caso_critico"])).toBe("Suporte N2");
    expect(handoffTeam(["pedido_do_funcionario", "chamado_vencido"])).toBe("Suporte N2");
    expect(handoffTeam(["pedido_do_funcionario"])).toBe("Suporte N1");
    expect(handoffTeam(["baixa_confianca"])).toBe("Suporte N1");
  });
});
