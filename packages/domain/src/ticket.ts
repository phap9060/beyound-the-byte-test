import { z } from "zod";

export const TICKET_TYPES = ["INC", "REQ"] as const;
export const TicketTypeSchema = z.enum(TICKET_TYPES);
export type TicketType = z.infer<typeof TicketTypeSchema>;

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  INC: "Incidente",
  REQ: "Requisição",
};

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

export const PRIORITIES = ["critica", "alta", "media", "baixa"] as const;
export const PrioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof PrioritySchema>;

export const PRIORITY_LABEL: Record<Priority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// "Não sei" fica de fora de propósito: o agent precisa esclarecer antes do rascunho.
export const AFFECTED_SCOPES = ["somente_eu", "equipe", "empresa"] as const;
export const AffectedSchema = z.enum(AFFECTED_SCOPES);
export type Affected = z.infer<typeof AffectedSchema>;

export const AFFECTED_LABEL: Record<Affected, string> = {
  somente_eu: "Somente você",
  equipe: "Sua equipe",
  empresa: "Toda a empresa",
};

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

export const TicketIdSchema = z.string().regex(/^(INC|REQ)-\d{4,}$/, "ID de chamado inválido");
export type TicketId = z.infer<typeof TicketIdSchema>;

export const TICKET_UPDATE_AUTHORS = ["funcionario", "agent", "analista"] as const;
export const TicketUpdateAuthorSchema = z.enum(TICKET_UPDATE_AUTHORS);
export type TicketUpdateAuthor = z.infer<typeof TicketUpdateAuthorSchema>;

export const TicketUpdateSchema = z.object({
  at: z.coerce.date(),
  author: TicketUpdateAuthorSchema,
  message: z.string().trim().min(1),
});
export type TicketUpdate = z.infer<typeof TicketUpdateSchema>;

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

export const TicketSchema = TicketDraftSchema.extend({
  id: TicketIdSchema,
  status: TicketStatusSchema,
  requesterId: z.string().min(1),
  createdAt: z.coerce.date(),
  // O prazo conta a partir da última atualização do suporte (Anexo A).
  lastSupportUpdateAt: z.coerce.date(),
  resolvedAt: z.coerce.date().optional(),
  updates: z.array(TicketUpdateSchema),
}).refine((t) => t.id.startsWith(`${t.type}-`), {
  message: "O prefixo do ID deve corresponder ao tipo do chamado",
  path: ["id"],
});
export type Ticket = z.infer<typeof TicketSchema>;
