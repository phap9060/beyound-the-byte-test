import { err } from "@nexo/domain";
import type { Context, Env, Input } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const STATUS_BY_CODE = {
  unauthorized: 401,
  employee_not_found: 404,
  ticket_not_found: 404,
  not_found: 404,
  validation_error: 400,
  missing_idempotency_key: 400,
  ticket_closed: 409,
  reopen_not_allowed: 409,
  idempotency_key_reused: 409,
  internal_error: 500,
  service_unavailable: 503,
} as const satisfies Record<string, ContentfulStatusCode>;

export type ErrorCode = keyof typeof STATUS_BY_CODE;

export interface ServiceError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ErrorBody {
  error: ServiceError;
}

export function serviceError(code: ErrorCode, message: string, details?: unknown): ServiceError {
  return { code, message, ...(details === undefined ? {} : { details }) };
}

export function fail(code: ErrorCode, message: string, details?: unknown) {
  return err(serviceError(code, message, details));
}

export function errorResponse<E extends Env, P extends string, I extends Input>(
  c: Context<E, P, I>,
  error: ServiceError,
) {
  return c.json<ErrorBody>({ error }, STATUS_BY_CODE[error.code]);
}
