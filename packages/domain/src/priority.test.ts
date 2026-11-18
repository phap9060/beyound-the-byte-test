import { describe, expect, it } from "vitest";

import { classifyPriority } from "./priority.ts";
import type { PriorityInput } from "./priority.ts";

const base: PriorityInput = {
  type: "INC",
  affected: "somente_eu",
  blocksWork: false,
  sameDayDeadline: false,
};

describe("classifyPriority", () => {
  it("crítica quando algo está parado para a equipe", () => {
    const r = classifyPriority({ ...base, affected: "equipe", blocksWork: true });
    expect(r).toMatchObject({ priority: "critica", rule: "parado_para_grupo" });
    expect(r.reason).toContain("uma equipe");
  });

  it("crítica quando algo está parado para a empresa toda", () => {
    const r = classifyPriority({ ...base, affected: "empresa", blocksWork: true });
    expect(r.priority).toBe("critica");
    expect(r.reason).toContain("a empresa");
  });

  it("alta quando impede uma pessoa de trabalhar", () => {
    expect(classifyPriority({ ...base, blocksWork: true })).toMatchObject({
      priority: "alta",
      rule: "impede_trabalho",
    });
  });

  it("alta quando há compromisso no mesmo dia (o caso da VPN e da reunião às 14h)", () => {
    expect(classifyPriority({ ...base, sameDayDeadline: true })).toMatchObject({
      priority: "alta",
      rule: "compromisso_hoje",
    });
  });

  it("média quando atrapalha, mas há alternativa (o notebook lento)", () => {
    expect(classifyPriority(base)).toMatchObject({ priority: "media", rule: "ha_alternativa" });
  });

  it("média quando a equipe é afetada mas nada parou", () => {
    expect(classifyPriority({ ...base, affected: "equipe" }).priority).toBe("media");
  });

  it("baixa para pedido sem urgência (o segundo monitor)", () => {
    expect(classifyPriority({ ...base, type: "REQ" })).toMatchObject({
      priority: "baixa",
      rule: "pedido_sem_urgencia",
    });
  });

  it("um pedido de acesso que impede o trabalho é alta, não baixa", () => {
    expect(classifyPriority({ ...base, type: "REQ", blocksWork: true }).priority).toBe("alta");
  });

  it("um pedido com compromisso hoje é alta", () => {
    expect(classifyPriority({ ...base, type: "REQ", sameDayDeadline: true }).priority).toBe("alta");
  });
});
