import { describe, expect, it } from "vitest";

import {
  addBusinessDays,
  addBusinessMinutes,
  isBusinessTime,
  nextBusinessStart,
} from "./business-time.ts";

// Datas em UTC; os comentários mostram o horário de Brasília. 16/11/2026 é segunda-feira.
const d = (iso: string) => new Date(iso);

describe("isBusinessTime", () => {
  it("quarta 09:43 está no expediente", () => {
    expect(isBusinessTime(d("2026-11-18T12:43:00Z"))).toBe(true);
  });

  it("18:00 em ponto já está fora do expediente", () => {
    expect(isBusinessTime(d("2026-11-18T21:00:00Z"))).toBe(false);
  });

  it("sábado não é dia útil", () => {
    expect(isBusinessTime(d("2026-11-21T13:00:00Z"))).toBe(false);
  });

  it("usa o horário de Brasília, não o UTC (terça 23:30 BRT = quarta 02:30 UTC)", () => {
    expect(isBusinessTime(d("2026-11-18T02:30:00Z"))).toBe(false);
  });
});

describe("nextBusinessStart", () => {
  it("dentro do expediente devolve a própria data", () => {
    const date = d("2026-11-18T12:43:00Z");
    expect(nextBusinessStart(date)).toEqual(date);
  });

  it("antes das 8h vai para as 8h do mesmo dia", () => {
    // quarta 06:00 → quarta 08:00
    expect(nextBusinessStart(d("2026-11-18T09:00:00Z"))).toEqual(d("2026-11-18T11:00:00Z"));
  });

  it("depois das 18h vai para as 8h do dia seguinte", () => {
    // quarta 20:00 → quinta 08:00
    expect(nextBusinessStart(d("2026-11-18T23:00:00Z"))).toEqual(d("2026-11-19T11:00:00Z"));
  });

  it("sexta à noite pula o fim de semana", () => {
    // sexta 19:00 → segunda 08:00
    expect(nextBusinessStart(d("2026-11-20T22:00:00Z"))).toEqual(d("2026-11-23T11:00:00Z"));
  });
});

describe("addBusinessMinutes", () => {
  it("cabe no mesmo dia", () => {
    // quarta 09:43 + 4h → quarta 13:43 (o exemplo do protótipo)
    expect(addBusinessMinutes(d("2026-11-18T12:43:00Z"), 240)).toEqual(d("2026-11-18T16:43:00Z"));
  });

  it("transborda para o dia seguinte", () => {
    // quarta 16:00 + 4h → 2h na quarta + 2h na quinta → quinta 10:00
    expect(addBusinessMinutes(d("2026-11-18T19:00:00Z"), 240)).toEqual(d("2026-11-19T13:00:00Z"));
  });

  it("atravessa o fim de semana", () => {
    // sexta 17:00 + 4h → 1h na sexta + 3h na segunda → segunda 11:00
    expect(addBusinessMinutes(d("2026-11-20T20:00:00Z"), 240)).toEqual(d("2026-11-23T14:00:00Z"));
  });

  it("aberto no sábado começa a contar na segunda às 8h", () => {
    // sábado 10:00 + 4h → segunda 12:00
    expect(addBusinessMinutes(d("2026-11-21T13:00:00Z"), 240)).toEqual(d("2026-11-23T15:00:00Z"));
  });

  it("terminar exatamente às 18h é válido", () => {
    // quarta 14:00 + 4h → quarta 18:00
    expect(addBusinessMinutes(d("2026-11-18T17:00:00Z"), 240)).toEqual(d("2026-11-18T21:00:00Z"));
  });

  it("minutos negativos ou inválidos contam como zero", () => {
    // sábado 10:00 → segunda 08:00
    const saturday = d("2026-11-21T13:00:00Z");
    expect(addBusinessMinutes(saturday, -1)).toEqual(d("2026-11-23T11:00:00Z"));
    expect(addBusinessMinutes(saturday, Number.NaN)).toEqual(d("2026-11-23T11:00:00Z"));
  });
});

describe("addBusinessDays", () => {
  it("3 dias úteis a partir de segunda 10:00 vencem quinta 10:00", () => {
    expect(addBusinessDays(d("2026-11-16T13:00:00Z"), 3)).toEqual(d("2026-11-19T13:00:00Z"));
  });

  it("5 dias úteis a partir de sexta 10:00 vencem na sexta seguinte 10:00", () => {
    expect(addBusinessDays(d("2026-11-20T13:00:00Z"), 5)).toEqual(d("2026-11-27T13:00:00Z"));
  });
});
