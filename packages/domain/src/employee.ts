import { z } from "zod";

export const EMPLOYEE_ROLES = ["funcionario", "analista"] as const;
export const EmployeeRoleSchema = z.enum(EMPLOYEE_ROLES);
export type EmployeeRole = z.infer<typeof EmployeeRoleSchema>;

export const EmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  email: z
    .email()
    .refine((e) => e.endsWith("@nexo.com.br"), "Use o e-mail corporativo (@nexo.com.br)"),
  department: z.string().trim().min(1),
  role: EmployeeRoleSchema,
  /** Só para analistas: equipe de suporte ("Suporte N1", "Suporte N2"). */
  supportTeam: z.string().optional(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

/** Iniciais para o avatar: "Ana Souza" → "AS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
