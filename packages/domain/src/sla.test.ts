import { describe, expect, it } from "vitest";

import { computeDueAt, getSlaStatus, isOverdue, slaLabel } from "./sla.ts";

const d = (iso: string) => new Date(iso);

describe("computeDueAt", () => {
  it("crítica: 1 hora corrida, mesmo de madrugada no sábado (plantão 24h)", () => {
    // sábado 03:00 → sábado 04:00
    expect(computeDueAt(d("2026-11-21T06:00:00Z"), "critica")).toEqual(d("2026-11-21T07:00:00Z"));
  });

  it("alta: 4 horas úteis", () => {
    // quarta 09:43 → quarta 13:43
    expect(computeDueAt(d("2026-11-18T12:43:00Z"), "alta")).toEqual(d("2026-11-18T16:43:00Z"));
  });

  it("média: 3 dias úteis", () => {
    expect(computeDueAt(d("2026-11-16T13:00:00Z"), "media")).toEqual(d("2026-11-19T13:00:00Z"));
  });

  it("baixa: 5 dias úteis", () => {
    expect(computeDueAt(d("2026-11-20T13:00:00Z"), "baixa")).toEqual(d("2026-11-27T13:00:00Z"));
  });
});

describe("getSlaStatus", () => {
  // INC-20311 do protótipo: prioridade média, sem atualização há 5 dias.
  const inc20311 = {
    status: "aguardando_analista",
    priority: "media",
    lastSupportUpdateAt: d("2026-11-13T13:00:00Z"), // sexta 10:00
  } as const;

  it("chamado parado há 5 dias com prioridade média está vencido", () => {
    // vence quarta 18/11 10:00; agora é quarta 18/11 10:05
    const status = getSlaStatus(inc20311, d("2026-11-18T13:05:00Z"));
    expect(status).toEqual({
      state: "vencido",
      dueAt: d("2026-11-18T13:00:00Z"),
      overdueMs: 5 * 60 * 1000,
    });
  });

  it("no exato instante do prazo ainda não está vencido", () => {
    expect(isOverdue(inc20311, d("2026-11-18T13:00:00Z"))).toBe(false);
  });

  it("chamado resolvido não tem prazo correndo", () => {
    expect(getSlaStatus({ ...inc20311, status: "resolvido" }, d("2026-12-30T00:00:00Z"))).toEqual({
      state: "nao_se_aplica",
    });
  });
});

describe("slaLabel", () => {
  it("usa os textos do Anexo A", () => {
    expect(slaLabel("critica")).toBe("1 hora");
    expect(slaLabel("alta")).toBe("4 horas úteis");
    expect(slaLabel("media")).toBe("3 dias úteis");
    expect(slaLabel("baixa")).toBe("5 dias úteis");
  });
});
