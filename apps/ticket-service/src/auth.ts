import { timingSafeEqual } from "node:crypto";

import { createMiddleware } from "hono/factory";

import { errorResponse, serviceError } from "./errors.ts";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function requireToken(token: string) {
  return createMiddleware(async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!safeEqual(provided, token)) {
      return errorResponse(c, serviceError("unauthorized", "Token de acesso ausente ou inválido"));
    }
    await next();
    return undefined;
  });
}
