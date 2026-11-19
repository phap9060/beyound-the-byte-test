export type UnavailableReason = "server_unavailable" | "network" | "timeout" | "deadline";

export type ClientError =
  | { kind: "service"; status: number; code: string; message: string; details?: unknown }
  | { kind: "unavailable"; reason: UnavailableReason; attempts: number }
  | { kind: "invalid_response"; message: string };
