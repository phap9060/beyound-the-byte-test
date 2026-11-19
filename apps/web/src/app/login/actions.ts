"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { endSession, homePathFor, startSession } from "@/server/session";
import { tickets } from "@/server/tickets";

export interface LoginState {
  error?: string;
  email?: string;
}

const LoginSchema = z.object({
  email: z
    .email("Informe um e-mail válido.")
    .refine((e) => e.endsWith("@nexo.com.br"), "Use seu e-mail corporativo (@nexo.com.br)."),
  password: z.string().min(1, "Informe sua senha."),
  remember: z.literal("on").optional(),
});

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";
  const parsed = LoginSchema.safeParse({
    email,
    password: formData.get("password"),
    remember: formData.get("remember") ?? undefined,
  });
  if (!parsed.success) {
    return { email, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const found = await tickets.findEmployeeByEmail(parsed.data.email);
  if (!found.ok) {
    const error =
      found.error.kind === "service" && found.error.code === "employee_not_found"
        ? "Não encontramos uma conta com esse e-mail."
        : "Não conseguimos verificar seu acesso agora. Tente de novo em instantes.";
    return { email, error };
  }

  const { id, name, department, role, supportTeam } = found.value;
  await startSession(
    {
      id,
      name,
      email: found.value.email,
      department,
      role,
      ...(supportTeam ? { supportTeam } : {}),
    },
    parsed.data.remember === "on",
  );
  redirect(homePathFor(role));
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
