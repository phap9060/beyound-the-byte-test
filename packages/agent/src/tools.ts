import { createTool } from "@mastra/core/tools";
import {
  AffectedSchema,
  CATEGORY_LABEL,
  CategorySchema,
  HANDOFF_REASON_LABEL,
  PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  TicketDraftSchema,
  TicketIdSchema,
  TicketTypeSchema,
  classifyPriority,
  handoffTeam,
  computeDueAt,
  isOpenStatus,
  reopenEligibility,
  slaLabel,
  toTicketView,
} from "@nexo/domain";
import type { HandoffReason, TicketSummary, TicketView } from "@nexo/domain";
import type { ClientError, TicketClient } from "@nexo/ticket-client";
import { z } from "zod";

import { formatDateTime } from "./format.ts";
import type { TurnRecorder } from "./recorder.ts";

export type AgentTicketClient = Pick<
  TicketClient,
  "listTickets" | "getTicket" | "searchKb" | "transferTicket"
>;

export interface ToolContext {
  employeeId: string;
  client: AgentTicketClient;
  now: Date;
  recorder: TurnRecorder;
}

const REOPEN_HINT = "Resolvido há mais de 7 dias: não pode ser reaberto, abra um novo chamado.";

function describeError(error: ClientError): string {
  switch (error.kind) {
    case "unavailable":
      return "O sistema de chamados está indisponível no momento. Tente de novo em instantes.";
    case "service":
      return error.status === 404
        ? "Chamado não encontrado entre os chamados deste funcionário."
        : error.message;
    case "invalid_response":
      return "O sistema de chamados respondeu de um jeito inesperado.";
  }
}

function slaForModel(view: TicketView): string {
  switch (view.sla.state) {
    case "vencido":
      return `VENCIDO desde ${formatDateTime(view.sla.dueAt)}`;
    case "no_prazo":
      return `no prazo, até ${formatDateTime(view.sla.dueAt)}`;
    case "nao_se_aplica":
      return "não se aplica (chamado encerrado)";
  }
}

function ticketForModel(ticket: TicketSummary, view: TicketView, now: Date) {
  const reopen = reopenEligibility(ticket, now);
  return {
    id: view.id,
    titulo: view.title,
    tipo: view.type,
    categoria: CATEGORY_LABEL[view.category],
    prioridade: PRIORITY_LABEL[view.priority],
    status: TICKET_STATUS_LABEL[view.status],
    prazo: slaForModel(view),
    ultimaAtualizacaoDoSuporte: formatDateTime(view.lastSupportUpdateAt),
    ...(ticket.status === "resolvido"
      ? { podeReabrir: reopen.eligible ? "sim" : REOPEN_HINT }
      : {}),
  };
}

export function createTools(ctx: ToolContext) {
  const { employeeId, client, now, recorder } = ctx;

  const consultarMeusChamados = createTool({
    id: "consultar_meus_chamados",
    description:
      "Lista os chamados do funcionário com status e prazo. Use para consultas, para achar um chamado sem o número e antes de abrir um chamado novo.",
    inputSchema: z.object({ situacao: z.enum(["abertos", "encerrados", "todos"]) }),
    execute: async ({ situacao }) => {
      const filter = situacao === "abertos" ? "open" : situacao === "encerrados" ? "closed" : "all";
      const result = await client.listTickets(employeeId, filter);
      if (!result.ok) {
        recorder.step("consultou seus chamados", "failed", describeError(result.error));
        return { erro: describeError(result.error) };
      }
      const items = result.value.map((ticket) => ({ ticket, view: toTicketView(ticket, now) }));
      recorder.remember(items.map((i) => i.view));
      const overdue = items.filter((i) => i.view.sla.state === "vencido").length;
      recorder.step(
        "consultou seus chamados",
        "done",
        `${String(items.length)} chamado(s) ${situacao}${overdue > 0 ? `, ${String(overdue)} vencido(s)` : ""}`,
      );
      return { chamados: items.map((i) => ticketForModel(i.ticket, i.view, now)) };
    },
  });

  const verChamado = createTool({
    id: "ver_chamado",
    description: "Mostra um chamado do funcionário com as últimas atualizações.",
    inputSchema: z.object({ ticketId: TicketIdSchema }),
    execute: async ({ ticketId }) => {
      const result = await client.getTicket(employeeId, ticketId);
      if (!result.ok) {
        recorder.step(`consultou o chamado ${ticketId}`, "failed", describeError(result.error));
        return { erro: describeError(result.error) };
      }
      const ticket = result.value;
      const view = toTicketView(ticket, now);
      recorder.remember([view]);
      recorder.step(`consultou o chamado ${ticketId}`, "done", slaForModel(view));
      return {
        chamado: {
          ...ticketForModel(ticket, view, now),
          descricao: ticket.description,
          ultimasAtualizacoes: ticket.updates.slice(-3).map((u) => ({
            quando: formatDateTime(u.at.toISOString()),
            autor: u.author,
            mensagem: u.message,
          })),
        },
      };
    },
  });

  const buscarCentralDeAjuda = createTool({
    id: "buscar_central_de_ajuda",
    description:
      "Busca artigos da central de ajuda. Use antes de abrir chamado para dúvidas e problemas comuns.",
    inputSchema: z.object({ consulta: z.string().min(2).describe("Palavras-chave do problema") }),
    execute: async ({ consulta }) => {
      const result = await client.searchKb(consulta, 3);
      if (!result.ok) {
        recorder.step("buscou na central de ajuda", "failed", describeError(result.error));
        return { erro: describeError(result.error) };
      }
      const titles = result.value.map((a) => a.title);
      recorder.step(
        "buscou na central de ajuda",
        "done",
        titles.length > 0 ? titles.join(" · ") : `nada encontrado para "${consulta}"`,
      );
      return { artigos: result.value.map((a) => ({ titulo: a.title, texto: a.body })) };
    },
  });

  const prepararRascunho = createTool({
    id: "preparar_rascunho",
    description:
      "Monta o rascunho de um chamado novo para o funcionário confirmar. Não cria o chamado: ele só é criado quando o funcionário confirmar no card. A prioridade é calculada pelas regras do service desk a partir dos fatos informados.",
    inputSchema: z.object({
      tipo: TicketTypeSchema.describe(
        "INC quando algo parou ou não funciona; REQ para pedido de acesso, equipamento ou software",
      ),
      titulo: z.string().min(5).max(120),
      descricao: z
        .string()
        .min(10)
        .max(2000)
        .describe("Tudo o que o analista precisa saber para não perguntar de novo"),
      categoria: CategorySchema,
      subcategoria: z.string().max(60).optional(),
      afetados: AffectedSchema.describe(
        "Quem é afetado: somente o funcionário, a equipe dele ou a empresa",
      ),
      impedeTrabalho: z.boolean().describe("O problema impede de trabalhar (não há alternativa)?"),
      compromissoHoje: z.boolean().describe("Há um compromisso hoje que depende disso?"),
      chamadosDiferentes: z
        .array(TicketIdSchema)
        .optional()
        .describe(
          "Chamados parecidos que o funcionário confirmou que são de outro problema. Só preencha depois de perguntar.",
        ),
    }),
    execute: async (input) => {
      const decision = classifyPriority({
        type: input.tipo,
        affected: input.afetados,
        blocksWork: input.impedeTrabalho,
        sameDayDeadline: input.compromissoHoje,
      });
      recorder.priority = decision;
      recorder.step(
        "classificou a prioridade",
        "done",
        `${PRIORITY_LABEL[decision.priority]}: ${decision.reason} Prazo de ${slaLabel(decision.priority)}.`,
      );

      const dismissed = new Set(input.chamadosDiferentes ?? []);
      const similar = await findSimilar(input.tipo, input.categoria);
      const pending = similar.filter((t) => !dismissed.has(t.id));
      if (similar.length > 0) {
        const listed = similar.map(
          (t) => `${t.id}${dismissed.has(t.id) ? " (outro problema)" : ""}`,
        );
        recorder.step("procurou chamados parecidos", "done", listed.join(", "));
      }
      if (pending.length > 0) {
        return {
          status: "possivel_duplicado",
          chamadosParecidos: pending,
          instrucao:
            "Pergunte se é o mesmo problema. Se for, ofereça complementar o chamado aberto (ou reabrir o resolvido). Se não for, chame preparar_rascunho de novo com esses IDs em chamadosDiferentes.",
        };
      }

      const draft = TicketDraftSchema.safeParse({
        type: input.tipo,
        title: input.titulo,
        description: input.descricao,
        category: input.categoria,
        subcategory: input.subcategoria,
        priority: decision.priority,
        affected: input.afetados,
      });
      if (!draft.success) {
        return { erro: z.prettifyError(draft.error) };
      }

      const dueAt = computeDueAt(now, decision.priority).toISOString();
      replaceProposal({
        type: "draft",
        draftId: crypto.randomUUID(),
        draft: draft.data,
        dueAt,
        state: "pending",
      });
      recorder.step("preparou o rascunho", "done", `${draft.data.type} · ${draft.data.title}`);
      return {
        status: "rascunho_exibido",
        prioridade: PRIORITY_LABEL[decision.priority],
        motivoDaPrioridade: decision.reason,
        prazo: slaLabel(decision.priority),
        instrucao:
          "O rascunho aparece num card abaixo da sua mensagem. Peça para o funcionário conferir e confirmar. O chamado ainda NÃO foi criado.",
      };
    },
  });

  async function findSimilar(type: TicketSummary["type"], category: TicketSummary["category"]) {
    const result = await client.listTickets(employeeId, "all");
    if (!result.ok) return [];
    return result.value
      .filter((t) => t.type === type && t.category === category)
      .filter((t) => isOpenStatus(t.status) || reopenEligibility(t, now).eligible)
      .map((t) => {
        const view = toTicketView(t, now);
        recorder.remember([view]);
        return ticketForModel(t, view, now);
      });
  }

  function replaceProposal(part: TurnRecorder["proposals"][number]) {
    recorder.proposals.length = 0;
    recorder.proposals.push(part);
  }

  const prepararComplemento = createTool({
    id: "preparar_complemento",
    description:
      "Prepara uma informação nova para ser adicionada a um chamado aberto do funcionário. Só é enviada quando ele confirmar.",
    inputSchema: z.object({
      ticketId: TicketIdSchema,
      mensagem: z.string().min(5).max(2000).describe("O complemento, escrito para o analista"),
    }),
    execute: async ({ ticketId, mensagem }) => {
      const result = await client.getTicket(employeeId, ticketId);
      if (!result.ok) {
        recorder.step("preparou um complemento", "failed", describeError(result.error));
        return { erro: describeError(result.error) };
      }
      const ticket = result.value;
      recorder.remember([toTicketView(ticket, now)]);
      if (!isOpenStatus(ticket.status)) {
        return {
          erro: `O chamado está ${TICKET_STATUS_LABEL[ticket.status]}; não dá para complementar.`,
        };
      }
      replaceProposal({
        type: "update_draft",
        draftId: crypto.randomUUID(),
        action: "complementar",
        ticketId,
        ticketTitle: ticket.title,
        message: mensagem,
        state: "pending",
      });
      recorder.step("preparou um complemento", "done", ticketId);
      return {
        status: "complemento_exibido",
        instrucao: "Peça para o funcionário confirmar no card.",
      };
    },
  });

  const prepararReabertura = createTool({
    id: "preparar_reabertura",
    description:
      "Prepara a reabertura de um chamado resolvido há até 7 dias, quando o problema voltou. Só é feita quando o funcionário confirmar.",
    inputSchema: z.object({
      ticketId: TicketIdSchema,
      motivo: z.string().min(5).max(2000).describe("O que voltou a acontecer"),
    }),
    execute: async ({ ticketId, motivo }) => {
      const result = await client.getTicket(employeeId, ticketId);
      if (!result.ok) {
        recorder.step("verificou a reabertura", "failed", describeError(result.error));
        return { erro: describeError(result.error) };
      }
      const ticket = result.value;
      recorder.remember([toTicketView(ticket, now)]);
      const eligibility = reopenEligibility(ticket, now);
      if (!eligibility.eligible) {
        const reason =
          eligibility.reason === "janela_expirada" ? REOPEN_HINT : "O chamado não está resolvido.";
        recorder.step("verificou a reabertura", "done", `${ticketId}: ${reason}`);
        return { erro: reason };
      }
      replaceProposal({
        type: "update_draft",
        draftId: crypto.randomUUID(),
        action: "reabrir",
        ticketId,
        ticketTitle: ticket.title,
        message: motivo,
        state: "pending",
      });
      recorder.step("preparou a reabertura", "done", ticketId);
      return {
        status: "reabertura_exibida",
        instrucao: "Peça para o funcionário confirmar no card.",
      };
    },
  });

  const transferirParaAnalista = createTool({
    id: "transferir_para_analista",
    description:
      "Passa a conversa para um analista humano. Depois disso você fica pausado até o analista devolver a conversa.",
    inputSchema: z.object({
      motivo: z.enum([
        "pedido_do_funcionario",
        "caso_critico",
        "chamado_vencido",
        "baixa_confianca",
      ]),
      resumo: z
        .string()
        .min(10)
        .max(1000)
        .describe("Resumo do caso para o analista: o problema, o que já foi tentado e o que falta"),
      ticketId: TicketIdSchema.optional().describe("Chamado relacionado, se houver"),
    }),
    execute: async ({ motivo, resumo, ticketId }) => {
      const reason: HandoffReason = motivo;
      recorder.handoff = { reason, summary: resumo, ...(ticketId ? { ticketId } : {}) };
      recorder.step("transferiu para um analista", "done", HANDOFF_REASON_LABEL[reason]);

      if (ticketId) {
        const team = handoffTeam([reason]);
        const result = await client.transferTicket(employeeId, ticketId, { team, summary: resumo });
        recorder.step(
          `encaminhou o ${ticketId}`,
          result.ok ? "done" : "failed",
          result.ok ? team : describeError(result.error),
        );
      }
      return {
        status: "transferido",
        instrucao:
          "Avise que um analista vai continuar o atendimento por aqui e que você fica pausado.",
      };
    },
  });

  return {
    consultar_meus_chamados: consultarMeusChamados,
    ver_chamado: verChamado,
    buscar_central_de_ajuda: buscarCentralDeAjuda,
    preparar_rascunho: prepararRascunho,
    preparar_complemento: prepararComplemento,
    preparar_reabertura: prepararReabertura,
    transferir_para_analista: transferirParaAnalista,
  };
}
