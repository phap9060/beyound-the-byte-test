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
} as const satisfies Record<string, ContentfulStatusCode>;

export type ErrorCode = keyof typeof STATUS_BY_CODE;

export class AppError extends Error {
  readonly status: ContentfulStatusCode;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS_BY_CODE[code];
  }
}

export interface ErrorBody {
  error: { code: ErrorCode | "internal_error"; message: string; details?: unknown };
}

export function errorBody(err: AppError): ErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
    },
  };
}
