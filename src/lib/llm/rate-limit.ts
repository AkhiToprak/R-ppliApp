// Minimal in-memory, per-key sliding-window rate limiter (per server instance, nothing persisted).

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** When not ok: milliseconds until the next request would be allowed. */
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
  /** Number of tracked keys (for tests / diagnostics). */
  size(): number;
}

export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const { limit, windowMs } = opts;
  const maxKeys = opts.maxKeys ?? 10_000;
  const hits = new Map<string, number[]>();

  function sweep(now: number) {
    const cutoff = now - windowMs;
    for (const [key, times] of hits) {
      if (times.length === 0 || times[times.length - 1] <= cutoff) hits.delete(key);
    }
    // Still too many active keys: drop the least recently used ones (Map keeps insertion order).
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(key);
    }
  }

  return {
    check(key, now = Date.now()) {
      const cutoff = now - windowMs;
      const times = (hits.get(key) ?? []).filter((t) => t > cutoff);
      hits.delete(key); // re-insert below → most recently used at the end
      if (times.length >= limit) {
        hits.set(key, times);
        return { ok: false, remaining: 0, retryAfterMs: Math.max(0, times[0] + windowMs - now) };
      }
      times.push(now);
      hits.set(key, times);
      if (hits.size > maxKeys) sweep(now);
      return { ok: true, remaining: limit - times.length, retryAfterMs: 0 };
    },
    size: () => hits.size,
  };
}

const MINUTE = 60_000;

/** Shared limiters for the API routes (module state lives as long as the server instance). */
export const routeLimiters = {
  categorise: createRateLimiter({ limit: 30, windowMs: MINUTE }),
  insights: createRateLimiter({ limit: 6, windowMs: MINUTE }),
  extract: createRateLimiter({ limit: 6, windowMs: MINUTE }),
  translate: createRateLimiter({ limit: 12, windowMs: MINUTE }),
};
