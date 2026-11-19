import "server-only";

import type { Employee, EmployeeRole } from "@nexo/domain";
import { getIronSession } from "iron-session";
import type { SessionOptions } from "iron-session";
import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "./env";

export type SessionUser = Pick<
  Employee,
  "id" | "name" | "email" | "department" | "role" | "supportTeam"
>;

interface SessionData {
  user?: SessionUser;
  sessionId?: string;
}

const HOUR = 60 * 60;
export const SESSION_TTL = { remember: 30 * 24 * HOUR, default: 12 * HOUR } as const;

const options: SessionOptions = {
  cookieName: "nexo_session",
  password: env.sessionSecret,
  ttl: SESSION_TTL.remember,
  cookieOptions: { httpOnly: true, sameSite: "lax", secure: env.isProduction, path: "/" },
};

async function getSession() {
  return getIronSession<SessionData>(await cookies(), options);
}

export async function startSession(user: SessionUser, remember: boolean): Promise<void> {
  const session = await getSession();
  session.updateConfig({ ...options, ttl: remember ? SESSION_TTL.remember : SESSION_TTL.default });
  session.user = user;
  session.sessionId = crypto.randomUUID();
  await session.save();
}

export async function endSession(): Promise<void> {
  (await getSession()).destroy();
}

export async function getCurrentUser(): Promise<(SessionUser & { sessionId: string }) | undefined> {
  const { user, sessionId } = await getSession();
  return user && sessionId ? { ...user, sessionId } : undefined;
}

export function homePathFor(role: EmployeeRole): Route {
  return role === "analista" ? "/console" : "/atendimento";
}

export async function requireUser(role: EmployeeRole) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homePathFor(user.role));
  return user;
}
