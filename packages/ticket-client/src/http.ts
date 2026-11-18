import { err, ok } from "@nexo/domain";
import type { Result } from "@nexo/domain";
import type { z } from "zod";

import { ErrorBodySchema } from "./contracts.ts";
import type { ClientError, UnavailableReason } from "./errors.ts";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface HttpOptions {
  baseUrl: string;
  token?: string | undefined;
  timeoutMs?: number;
  // Tempo máximo total de uma chamada, somando tentativas e esperas: o funcionário está no chat esperando.
  deadlineMs?: number;
  retry?: Partial<RetryPolicy>;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  onRetry?: (info: RetryInfo) => void;
}

export interface RetryInfo {
  method: string;
  path: string;
  attempt: number;
  reason: UnavailableReason;
  delayMs: number;
}

export interface RequestSpec<S extends z.ZodType> {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  schema: S;
  // Se a mesma requisição pode ser repetida sem efeito duplicado (GET, ou POST com chave de idempotência).
  idempotent: boolean;
}

const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 4, baseDelayMs: 250, maxDelayMs: 5000 };
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

type Attempt =
  | { outcome: "response"; response: Response }
  | { outcome: "failed"; reason: UnavailableReason; retryAfterMs?: number };

export function createHttp(options: HttpOptions) {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 3000;
  const deadlineMs = options.deadlineMs ?? 12_000;
  const retry = { ...DEFAULT_RETRY, ...options.retry };
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  async function attempt(spec: RequestSpec<z.ZodType>): Promise<Attempt> {
    try {
      const response = await doFetch(`${baseUrl}${spec.path}`, {
        method: spec.method,
        headers: {
          Accept: "application/json",
          ...(spec.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...spec.headers,
        },
        ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!RETRYABLE_STATUS.has(response.status)) return { outcome: "response", response };

      const retryAfter = Number(response.headers.get("Retry-After"));
      return {
        outcome: "failed",
        reason: "server_unavailable",
        ...(Number.isFinite(retryAfter) && retryAfter > 0
          ? { retryAfterMs: retryAfter * 1000 }
          : {}),
      };
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      return { outcome: "failed", reason: timedOut ? "timeout" : "network" };
    }
  }

  function backoff(attemptNumber: number, retryAfterMs = 0): number {
    const exponential = Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** (attemptNumber - 1));
    const jittered = exponential * (0.5 + random() * 0.5);
    return Math.max(jittered, Math.min(retryAfterMs, retry.maxDelayMs));
  }

  async function parse<S extends z.ZodType>(
    response: Response,
    schema: S,
  ): Promise<Result<z.infer<S>, ClientError>> {
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return err({
        kind: "invalid_response",
        message: `Resposta sem JSON (${String(response.status)})`,
      });
    }

    if (!response.ok) {
      const body = ErrorBodySchema.safeParse(json);
      if (!body.success) {
        return err({
          kind: "invalid_response",
          message: `Erro ${String(response.status)} fora do contrato`,
        });
      }
      const { code, message, details } = body.data.error;
      return err({
        kind: "service",
        status: response.status,
        code,
        message,
        ...(details === undefined ? {} : { details }),
      });
    }

    const parsed = schema.safeParse(json);
    return parsed.success
      ? ok(parsed.data)
      : err({ kind: "invalid_response", message: parsed.error.message });
  }

  async function request<S extends z.ZodType>(
    spec: RequestSpec<S>,
  ): Promise<Result<z.infer<S>, ClientError>> {
    const deadline = now() + deadlineMs;

    for (let n = 1; ; n++) {
      const result = await attempt(spec);
      if (result.outcome === "response") return parse(result.response, spec.schema);

      // Timeout num POST sem idempotência é ambíguo: o servidor pode ter gravado. Não repete.
      const ambiguous = result.reason === "timeout" && !spec.idempotent;
      if (ambiguous || n >= retry.maxAttempts) {
        return err({ kind: "unavailable", reason: result.reason, attempts: n });
      }

      const delayMs = backoff(n, result.retryAfterMs);
      if (now() + delayMs + timeoutMs > deadline) {
        return err({ kind: "unavailable", reason: "deadline", attempts: n });
      }

      options.onRetry?.({
        method: spec.method,
        path: spec.path,
        attempt: n,
        reason: result.reason,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  return { request };
}
