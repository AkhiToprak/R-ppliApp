// Small helpers shared by the /api route handlers (server-side only).

import type { RateLimiter } from "./rate-limit";

export type ApiErrorCode =
  | "llm_unavailable"
  | "llm_failed"
  | "rate_limited"
  | "invalid_request"
  | "payload_too_large"
  | "no_transactions";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function jsonError(status: number, error: ApiErrorCode, headers?: Record<string, string>): Response {
  return json({ error }, status, headers);
}

/** Best-effort client IP from proxy headers (Vercel / reverse proxies). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

/** Returns a 429 response if the client is over the limit, otherwise null. */
export function enforceRateLimit(limiter: RateLimiter, request: Request): Response | null {
  const r = limiter.check(clientIp(request));
  if (r.ok) return null;
  return jsonError(429, "rate_limited", { "Retry-After": String(Math.max(1, Math.ceil(r.retryAfterMs / 1000))) });
}

/**
 * Reads and JSON-parses the request body, aborting once `maxBytes` is exceeded.
 * Returns either the parsed value or a ready-made error response.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: jsonError(413, "payload_too_large") };
  }
  if (!request.body) return { ok: false, response: jsonError(400, "invalid_request") };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, response: jsonError(413, "payload_too_large") };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: jsonError(400, "invalid_request") };
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: jsonError(400, "invalid_request") };
  }
}
