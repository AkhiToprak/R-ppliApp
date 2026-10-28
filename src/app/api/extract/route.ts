import { enforceRateLimit, json, jsonError, readJsonBody } from "@/lib/llm/http";
import { chatJSON, isLLMConfigured, LLMUnavailableError } from "@/lib/llm/openrouter";
import { extractSystemPrompt, extractUserPrompt } from "@/lib/llm/prompts";
import { routeLimiters } from "@/lib/llm/rate-limit";
import { extractOutputSchema, extractRequestSchema, extractWireSchema, normaliseExtracted } from "@/lib/llm/schemas";
import type { ExtractResponse } from "@/lib/types";

export const maxDuration = 90;

// 60k chars of (mostly ASCII) text plus JSON overhead; non-ASCII chars may take up to 3 bytes.
const MAX_BODY_BYTES = 200 * 1024;

/**
 * POST /api/extract
 * Body: ExtractRequest `{ text }` (≤ 60'000 chars, already redacted client-side).
 * 200 → ExtractResponse `{ transactions: [{ date, description, counterparty?, amount, currency }], currency, bank? }`.
 * 503 `llm_unavailable`, 422 `no_transactions`, 502 `llm_failed`, 429, 400, 413.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isLLMConfigured()) return jsonError(503, "llm_unavailable");

  const limited = enforceRateLimit(routeLimiters.extract, request);
  if (limited) return limited;

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = extractRequestSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "invalid_request");
  const { text } = parsed.data;

  try {
    const out = await chatJSON({
      label: "extract",
      system: extractSystemPrompt(),
      user: extractUserPrompt(text),
      schema: extractOutputSchema,
      wireSchema: extractWireSchema,
      schemaName: "statement_transactions",
      temperature: 0,
      // ~1 output token per 2 input chars is plenty for a compact transaction list.
      maxTokens: Math.min(32_000, 1_000 + Math.ceil(text.length / 2)),
      timeoutMs: 75_000,
      budgetMs: 85_000,
      signal: request.signal,
    });
    const result: ExtractResponse = normaliseExtracted(out);
    if (result.transactions.length === 0) return jsonError(422, "no_transactions");
    return json(result);
  } catch (err) {
    if (err instanceof LLMUnavailableError) return jsonError(503, "llm_unavailable");
    return jsonError(502, "llm_failed");
  }
}
