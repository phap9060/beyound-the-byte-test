// Janela deslizante em memória. Basta para uma instância; com várias, iria para o Redis.
export interface RateLimit {
  max: number;
  windowMs: number;
}

export type Take = { ok: true } | { ok: false; retryAfterMs: number };

export function createLimiter({ max, windowMs }: RateLimit) {
  const hits = new Map<string, number[]>();

  return {
    take(key: string, now = Date.now()): Take {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        const oldest = recent[0] ?? now;
        hits.set(key, recent);
        return { ok: false, retryAfterMs: oldest + windowMs - now };
      }
      recent.push(now);
      hits.set(key, recent);
      return { ok: true };
    },
  };
}
