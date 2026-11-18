import { describe, expect, it } from "vitest";

import { initials } from "./employee.ts";
import { TicketDraftSchema, TicketSchema, isOpenStatus } from "./ticket.ts";

const validDraft = {
  type: "INC",
  title: "VPN não conecta no notebook — erro 809",
  description: "Desde ontem o notebook (Windows 11) não conecta na VPN e mostra o erro 809.",
  category: "rede_vpn",
  priority: "alta",
  affected: "somente_eu",
} as const;

describe("TicketDraftSchema", () => {
  it("aceita um rascunho completo", () => {
    expect(TicketDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  it.each(["type", "title", "description", "category", "priority", "affected"] as const)(
    "rejeita rascunho sem o campo obrigatório %s",
    (field) => {
      const { [field]: _removed, ...incomplete } = validDraft;
      expect(TicketDraftSchema.safeParse(incomplete).success).toBe(false);
    },
  );

  it("rejeita categoria fora do Anexo A", () => {
    expect(TicketDraftSchema.safeParse({ ...validDraft, category: "rh" }).success).toBe(false);
  });
});

describe("TicketSchema", () => {
  const base = {
    ...validDraft,
    id: "INC-20517",
    status: "aguardando_analista",
    requesterId: "emp-ana",
    createdAt: "2026-10-21T12:43:00.000Z",
    lastSupportUpdateAt: "2026-10-21T12:43:00.000Z",
    updates: [],
  };

  it("aceita um chamado válido e converte as datas", () => {
    const parsed = TicketSchema.parse(base);
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });

  it("rejeita ID com prefixo diferente do tipo", () => {
    expect(TicketSchema.safeParse({ ...base, id: "REQ-20517" }).success).toBe(false);
  });
});

describe("isOpenStatus", () => {
  it("considera aberto o que ainda está em andamento", () => {
    expect(isOpenStatus("aguardando_analista")).toBe(true);
    expect(isOpenStatus("aprovado")).toBe(true);
    expect(isOpenStatus("resolvido")).toBe(false);
    expect(isOpenStatus("cancelado")).toBe(false);
  });
});

describe("initials", () => {
  it("usa a primeira letra do primeiro e do último nome", () => {
    expect(initials("Ana Souza")).toBe("AS");
    expect(initials("Rafael de Lima")).toBe("RL");
    expect(initials("Diego")).toBe("D");
  });
});
