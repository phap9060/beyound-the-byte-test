import { EmployeeSchema, getSlaStatus, isOverdue, reopenEligibility } from "@nexo/domain";
import { describe, expect, it } from "vitest";

import { openDatabase } from "./client.ts";
import { seedIfEmpty } from "./seed.ts";
import { buildSeedData } from "./seed-data.ts";

const NOWS = {
  "segunda 08:05": new Date("2026-11-16T11:05:00Z"),
  "quarta 10:00": new Date("2026-11-18T13:00:00Z"),
  "sexta 17:50": new Date("2026-11-20T20:50:00Z"),
  "sábado 15:00": new Date("2026-11-21T18:00:00Z"),
  "domingo 23:00": new Date("2026-11-23T02:00:00Z"),
};

describe("seedIfEmpty", () => {
  it("popula o banco vazio uma única vez", async () => {
    const db = await openDatabase(":memory:");

    expect(await seedIfEmpty(db)).toBe(true);
    expect(await seedIfEmpty(db)).toBe(false);

    const all = await db.query.tickets.findMany();
    expect(all).toHaveLength(buildSeedData(new Date()).tickets.length);
  });
});

describe.each(Object.entries(NOWS))(
  "situações do Anexo B valem em qualquer momento (%s)",
  (_, now) => {
    const data = buildSeedData(now);
    const ticket = (id: string) => {
      const t = data.tickets.find((x) => x.id === id);
      if (!t) throw new Error(`${id} não está no seed`);
      return { ...t, resolvedAt: t.resolvedAt ?? undefined };
    };

    it("INC-20311 está vencido", () => {
      expect(isOverdue(ticket("INC-20311"), now)).toBe(true);
    });

    it("os outros chamados abertos estão no prazo", () => {
      const open = data.tickets.filter(
        (t) => t.id !== "INC-20311" && t.status !== "resolvido" && t.status !== "cancelado",
      );
      for (const t of open) {
        expect(getSlaStatus(ticket(t.id), now).state, t.id).toBe("no_prazo");
      }
    });

    it("INC-20150 (resolvido há 4 dias) pode ser reaberto", () => {
      expect(reopenEligibility(ticket("INC-20150"), now)).toEqual({ eligible: true });
    });

    it("INC-19877 (resolvido há 20 dias) não pode ser reaberto", () => {
      expect(reopenEligibility(ticket("INC-19877"), now)).toEqual({
        eligible: false,
        reason: "janela_expirada",
      });
    });
  },
);

describe("dados de exemplo", () => {
  const data = buildSeedData(new Date());

  it("todos os funcionários são válidos pelo domínio", () => {
    for (const e of data.employees) {
      expect(
        EmployeeSchema.safeParse({ ...e, supportTeam: e.supportTeam ?? undefined }).success,
      ).toBe(true);
    }
  });

  it("todo chamado pertence a um funcionário existente", () => {
    const ids = new Set(data.employees.map((e) => e.id));
    for (const t of data.tickets) expect(ids.has(t.requesterId), t.id).toBe(true);
  });

  it("tem chamados de mais de um funcionário (para testar privacidade)", () => {
    expect(new Set(data.tickets.map((t) => t.requesterId)).size).toBeGreaterThan(1);
  });

  it("tem de 5 a 10 artigos na central de ajuda", () => {
    expect(data.kbArticles.length).toBeGreaterThanOrEqual(5);
    expect(data.kbArticles.length).toBeLessThanOrEqual(10);
  });
});
