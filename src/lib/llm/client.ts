import type { Analysis, ExtractResponse, Insights, Locale } from "@/lib/types";
import { buildFallbackInsights } from "./fallback-insights";

// Browser-side wrappers around the API routes. Must NOT import ./openrouter (server-only).

const INSIGHTS_TIMEOUT_MS = 40_000;
const TRANSLATE_TIMEOUT_MS = 40_000;
const EXTRACT_TIMEOUT_MS = 95_000;

function isInsights(v: unknown): v is Insights {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.score === "number" &&
    typeof o.persona === "string" &&
    typeof o.personaText === "string" &&
    Array.isArray(o.strengths) &&
    Array.isArray(o.weaknesses) &&
    Array.isArray(o.critiques) &&
    Array.isArray(o.savings) &&
    (o.source === "llm" || o.source === "fallback")
  );
}

function isExtractResponse(v: unknown): v is ExtractResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.currency === "string" && Array.isArray(o.transactions);
}

// fetchInsights never throws: on failure it returns a locally computed fallback (source: "fallback").
export async function fetchInsights(analysis: Analysis, locale: Locale): Promise<Insights> {
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, analysis }),
      signal: AbortSignal.timeout(INSIGHTS_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) {
      const data: unknown = await res.json();
      if (isInsights(data)) return data;
    }
  } catch {
    // network error, timeout, invalid JSON → fall through to local fallback
  }
  return buildFallbackInsights(analysis, locale);
}

// Translates model insights into `locale` (texts only). Throws on failure; the caller keeps the original.
export async function translateInsights(insights: Insights, locale: Locale): Promise<Insights> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, insights }),
    signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`translation failed: status ${res.status}`);
  const data: unknown = await res.json();
  if (!isInsights(data)) throw new Error("translation failed: invalid response");
  return data;
}

// Sends redacted PDF text to /api/extract. Throws Error("pdf_extraction_failed") on failure.
export async function extractFromText(text: string): Promise<ExtractResponse> {
  let data: unknown;
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    data = await res.json();
  } catch {
    throw new Error("pdf_extraction_failed");
  }
  if (!isExtractResponse(data) || data.transactions.length === 0) throw new Error("pdf_extraction_failed");
  return data;
}
