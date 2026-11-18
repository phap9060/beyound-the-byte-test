import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "./app.ts";
import { openDatabase } from "./db/client.ts";
import { seedIfEmpty } from "./db/seed.ts";

const NOW = new Date("2026-11-18T13:00:00Z");

let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  const db = await openDatabase(":memory:");
  await seedIfEmpty(db, NOW);
  app = createApp(db, { now: () => NOW });
});

type Json = Record<string, unknown>;
interface TicketItem {
  id: string;
  requesterId: string;
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  const res = await app.request(path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, json: await res.json() };
}

async function call(...args: Parameters<typeof request>) {
  const { status, json } = await request(...args);
  return { status, body: json as Json };
}

async function list(path: string) {
  const { json } = await request("GET", path);
  return json as TicketItem[];
}

const draft = {
  type: "INC",
  title: "VPN não conecta — erro 809",
  description: "Desde ontem o notebook (Windows 11) não conecta na VPN e mostra o erro 809.",
  category: "rede_vpn",
  priority: "alta",
  affected: "somente_eu",
};

describe("GET /health", () => {
  it("responde ok", async () => {
    expect(await call("GET", "/health")).toEqual({ status: 200, body: { status: "ok" } });
  });
});

describe("funcionários", () => {
  it("encontra pelo e-mail, sem diferenciar maiúsculas", async () => {
    const { status, body } = await call("GET", "/employees?email=Ana.Souza@nexo.com.br");
    expect(status).toBe(200);
    expect(body).toMatchObject({ id: "emp-ana", name: "Ana Souza" });
  });

  it("e-mail desconhecido dá 404", async () => {
    const { status, body } = await call("GET", "/employees?email=ninguem@nexo.com.br");
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: { code: "employee_not_found" } });
  });
});

describe("listar chamados", () => {
  it("devolve só os chamados do funcionário", async () => {
    const body = await list("/employees/emp-ana/tickets");
    expect(body).toHaveLength(6);
    expect(body.every((t) => t.requesterId === "emp-ana")).toBe(true);
  });

  it("filtra os abertos", async () => {
    const body = await list("/employees/emp-ana/tickets?status=open");
    expect(body.map((t) => t.id).sort()).toEqual(["INC-20298", "INC-20311", "REQ-10442"]);
  });

  it("funcionário inexistente dá 404", async () => {
    const { status, body } = await call("GET", "/employees/emp-x/tickets");
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: { code: "employee_not_found" } });
  });

  it("filtro inválido dá 400", async () => {
    const { status, body } = await call("GET", "/employees/emp-ana/tickets?status=todos");
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: { code: "validation_error" } });
  });
});

describe("privacidade", () => {
  it("o chamado do Bruno não existe para a Ana", async () => {
    const { status, body } = await call("GET", "/employees/emp-ana/tickets/INC-20335");
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: { code: "ticket_not_found" } });
  });

  it("a Ana não consegue atualizar o chamado do Bruno", async () => {
    const { status } = await call("POST", "/employees/emp-ana/tickets/INC-20335/updates", {
      author: "funcionario",
      message: "teste",
    });
    expect(status).toBe(404);
  });
});

describe("detalhe do chamado", () => {
  it("traz o histórico de atualizações", async () => {
    const { status, body } = await call("GET", "/employees/emp-ana/tickets/INC-20298");
    expect(status).toBe(200);
    expect(body).toMatchObject({ id: "INC-20298", status: "em_andamento" });
    expect(body.updates).toHaveLength(1);
  });
});

describe("criar chamado", () => {
  const key = { "Idempotency-Key": "conv-1-draft-1" };

  it("cria com o próximo número e status aguardando analista", async () => {
    const { status, body } = await call("POST", "/employees/emp-ana/tickets", draft, key);
    expect(status).toBe(201);
    expect(body).toMatchObject({
      id: "INC-20336",
      status: "aguardando_analista",
      requesterId: "emp-ana",
      createdAt: NOW.toISOString(),
    });
  });

  it("repetir a mesma chave devolve o mesmo chamado, sem duplicar", async () => {
    const first = await call("POST", "/employees/emp-ana/tickets", draft, key);
    const retry = await call("POST", "/employees/emp-ana/tickets", draft, key);

    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(first.body.id);
    expect((await call("GET", "/employees/emp-ana/tickets")).body).toHaveLength(7);
  });

  it("a mesma chave usada por outro funcionário é recusada", async () => {
    await call("POST", "/employees/emp-ana/tickets", draft, key);
    const { status, body } = await call("POST", "/employees/emp-bruno/tickets", draft, key);
    expect(status).toBe(409);
    expect(body).toMatchObject({ error: { code: "idempotency_key_reused" } });
  });

  it("exige a chave de idempotência", async () => {
    const { status, body } = await call("POST", "/employees/emp-ana/tickets", draft);
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: { code: "missing_idempotency_key" } });
  });

  it("recusa rascunho incompleto, dizendo o campo", async () => {
    const { title: _t, ...semTitulo } = draft;
    const { status, body } = await call("POST", "/employees/emp-ana/tickets", semTitulo, key);
    expect(status).toBe(400);
    expect(body).toMatchObject({
      error: { code: "validation_error", details: [{ path: "title" }] },
    });
  });

  it("numera requisições separadamente dos incidentes", async () => {
    const req = { ...draft, type: "REQ", category: "software", priority: "baixa" };
    const { body } = await call("POST", "/employees/emp-ana/tickets", req, key);
    expect(body.id).toBe("REQ-10461");
  });
});

describe("adicionar informação", () => {
  it("o funcionário complementa sem reiniciar o prazo", async () => {
    const before = await call("GET", "/employees/emp-ana/tickets/INC-20311");
    const { status, body } = await call("POST", "/employees/emp-ana/tickets/INC-20311/updates", {
      author: "funcionario",
      message: "Agora também trava ao abrir o Excel.",
    });
    expect(status).toBe(200);
    expect(body.updates).toHaveLength(1);
    expect(body.lastSupportUpdateAt).toBe(before.body.lastSupportUpdateAt);
  });

  it("a resposta do analista reinicia o prazo e põe em andamento", async () => {
    const { body } = await call("POST", "/employees/emp-ana/tickets/INC-20311/updates", {
      author: "analista",
      message: "Vou verificar o driver de vídeo remotamente.",
    });
    expect(body).toMatchObject({ status: "em_andamento", lastSupportUpdateAt: NOW.toISOString() });
  });

  it("chamado resolvido não aceita atualização", async () => {
    const { status, body } = await call("POST", "/employees/emp-ana/tickets/INC-20150/updates", {
      author: "funcionario",
      message: "Bloqueou de novo.",
    });
    expect(status).toBe(409);
    expect(body).toMatchObject({ error: { code: "ticket_closed" } });
  });
});

describe("reabrir", () => {
  it("reabre o resolvido há 4 dias", async () => {
    const { status, body } = await call("POST", "/employees/emp-ana/tickets/INC-20150/reopen", {
      message: "A senha bloqueou de novo.",
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "aguardando_analista" });
    expect(body.resolvedAt).toBeUndefined();
  });

  it("recusa o resolvido há mais de 7 dias, dizendo o motivo", async () => {
    const { status, body } = await call("POST", "/employees/emp-ana/tickets/INC-19877/reopen", {
      message: "Parou de novo.",
    });
    expect(status).toBe(409);
    expect(body).toMatchObject({
      error: { code: "reopen_not_allowed", details: { reason: "janela_expirada" } },
    });
  });
});

describe("transferir", () => {
  it("registra a equipe e o resumo", async () => {
    const { status, body } = await call("POST", "/employees/emp-ana/tickets/INC-20311/transfer", {
      team: "Suporte N2",
      summary: "Notebook lento há 6 dias, prazo vencido; funcionária pediu um analista.",
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ assignedTeam: "Suporte N2" });
    expect(body.updates).toHaveLength(1);
  });
});

describe("central de ajuda", () => {
  it("acha o artigo da VPN 809 primeiro", async () => {
    const body = await list("/kb/search?q=minha vpn deu erro 809");
    expect(body[0]).toMatchObject({ id: "KB-001" });
  });

  it("ignora acentos e maiúsculas", async () => {
    const body = await list("/kb/search?q=HORARIO de atendimento");
    expect(body[0]).toMatchObject({ id: "KB-002" });
  });

  it("assunto fora da base devolve lista vazia", async () => {
    const { body } = await call("GET", "/kb/search?q=quero tirar férias");
    expect(body).toEqual([]);
  });
});

describe("token de acesso", () => {
  it("quando configurado, exige o token (menos no /health)", async () => {
    const db = await openDatabase(":memory:");
    const secured = createApp(db, { token: "segredo-com-16-chars" });

    expect((await secured.request("/health")).status).toBe(200);
    expect((await secured.request("/employees/emp-ana/tickets")).status).toBe(401);
    expect(
      (
        await secured.request("/employees/emp-ana/tickets", {
          headers: { Authorization: "Bearer segredo-com-16-chars" },
        })
      ).status,
    ).toBe(404);
  });
});
