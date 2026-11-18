import { z } from "zod";

/**
 * Tipos, categorias, prioridades e status de chamado (Anexo A).
 *
 * Cada conjunto é definido uma única vez como uma lista `as const`
 * (ex.: CATEGORIES). Dela saem o schema Zod (validação em tempo de execução),
 * o tipo TypeScript (`z.infer`) e as colunas do banco (Drizzle). Assim nada
 * diverge.
 */

// ── Tipo ────────────────────────────────────────────────────────────────
// INC: algo parou ou não funciona. REQ: pedido de acesso, equipamento ou software.
export const TICKET_TYPES = ["INC", "REQ"] as const;
export const TicketTypeSchema = z.enum(TICKET_TYPES);
export type TicketType = z.infer<typeof TicketTypeSchema>;

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  INC: "Incidente",
  REQ: "Requisição",
};

// ── Categoria ───────────────────────────────────────────────────────────
export const CATEGORIES = [
  "acesso",
  "rede_vpn",
  "hardware",
  "software",
  "email",
  "outros",
] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

export const CATEGORY_LABEL: Record<Category, string> = {
  acesso: "Acesso",
  rede_vpn: "Rede e VPN",
  hardware: "Hardware",
  software: "Software",
  email: "E-mail",
  outros: "Outros",
};

// ── Prioridade ──────────────────────────────────────────────────────────
export const PRIORITIES = ["critica", "alta", "media", "baixa"] as const;
export const PrioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof PrioritySchema>;

export const PRIORITY_LABEL: Record<Priority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// ── Quem é afetado ──────────────────────────────────────────────────────
// Corresponde às opções rápidas do protótipo ("Só eu", "Minha equipe", "Toda a empresa").
// "Não sei" não é um valor válido: o agent deve esclarecer antes de montar o rascunho.
export const AFFECTED_SCOPES = ["somente_eu", "equipe", "empresa"] as const;
export const AffectedSchema = z.enum(AFFECTED_SCOPES);
export type Affected = z.infer<typeof AffectedSchema>;

export const AFFECTED_LABEL: Record<Affected, string> = {
  somente_eu: "Somente você",
  equipe: "Sua equipe",
  empresa: "Toda a empresa",
};

// ── Status ──────────────────────────────────────────────────────────────
export const TICKET_STATUSES = [
  "aguardando_analista",
  "em_andamento",
  "aprovado",
  "resolvido",
  "cancelado",
] as const;
export const TicketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  aguardando_analista: "Aguardando analista",
  em_andamento: "Em andamento",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

/** Status em que o chamado ainda está "vivo": conta prazo e pode ser atualizado. */
export function isOpenStatus(status: TicketStatus): boolean {
  switch (status) {
    case "aguardando_analista":
    case "em_andamento":
    case "aprovado":
      return true;
    case "resolvido":
    case "cancelado":
      return false;
  }
}

// ── Identificador ───────────────────────────────────────────────────────
// Ex.: INC-20311, REQ-10442. O prefixo precisa bater com o tipo do chamado.
export const TicketIdSchema = z.string().regex(/^(INC|REQ)-\d{4,}$/, "ID de chamado inválido");
export type TicketId = z.infer<typeof TicketIdSchema>;

// ── Atualização (comentário) num chamado ────────────────────────────────
export const TICKET_UPDATE_AUTHORS = ["funcionario", "agent", "analista"] as const;
export const TicketUpdateAuthorSchema = z.enum(TICKET_UPDATE_AUTHORS);
export type TicketUpdateAuthor = z.infer<typeof TicketUpdateAuthorSchema>;

export const TicketUpdateSchema = z.object({
  at: z.coerce.date(),
  author: TicketUpdateAuthorSchema,
  message: z.string().trim().min(1),
});
export type TicketUpdate = z.infer<typeof TicketUpdateSchema>;

// ── Rascunho ────────────────────────────────────────────────────────────
// Tudo que o Anexo A exige para abrir um chamado: título, descrição, tipo,
// categoria, prioridade e quem é afetado. É o que o agent mostra para
// confirmação antes de criar.
export const TicketDraftSchema = z.object({
  type: TicketTypeSchema,
  title: z.string().trim().min(5, "Título muito curto").max(120),
  description: z.string().trim().min(10, "Descrição muito curta").max(2000),
  category: CategorySchema,
  subcategory: z.string().trim().min(1).max(60).optional(),
  priority: PrioritySchema,
  affected: AffectedSchema,
});
export type TicketDraft = z.infer<typeof TicketDraftSchema>;

// ── Chamado ─────────────────────────────────────────────────────────────
export const TicketSchema = TicketDraftSchema.extend({
  id: TicketIdSchema,
  status: TicketStatusSchema,
  requesterId: z.string().min(1),
  createdAt: z.coerce.date(),
  /** Última resposta/atualização do service desk. É daqui que o prazo conta (Anexo A). */
  lastSupportUpdateAt: z.coerce.date(),
  /** Preenchido quando o status vira "resolvido". Usado na regra de reabertura (7 dias). */
  resolvedAt: z.coerce.date().optional(),
  updates: z.array(TicketUpdateSchema),
}).refine((t) => t.id.startsWith(`${t.type}-`), {
  message: "O prefixo do ID deve corresponder ao tipo do chamado",
  path: ["id"],
});
export type Ticket = z.infer<typeof TicketSchema>;
