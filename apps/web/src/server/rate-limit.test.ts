import { describe, expect, it } from "vitest";

import { createLimiter } from "./rate-limit";

describe("createLimiter", () => {
  it("libera até o máximo e informa quando tentar de novo", () => {
    const limiter = createLimiter({ max: 2, windowMs: 60_000 });

    expect(limiter.take("ana", 0)).toEqual({ ok: true });
    expect(limiter.take("ana", 10_000)).toEqual({ ok: true });
    expect(limiter.take("ana", 20_000)).toEqual({ ok: false, retryAfterMs: 40_000 });
    expect(limiter.take("bruno", 20_000)).toEqual({ ok: true });
  });

  it("libera de novo quando a janela passa", () => {
    const limiter = createLimiter({ max: 1, windowMs: 60_000 });

    expect(limiter.take("ana", 0).ok).toBe(true);
    expect(limiter.take("ana", 59_999).ok).toBe(false);
    expect(limiter.take("ana", 60_000).ok).toBe(true);
  });
});
