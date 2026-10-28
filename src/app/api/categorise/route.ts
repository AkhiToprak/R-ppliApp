import { enforceRateLimit, json, jsonError, readJsonBody } from "@/lib/llm/http";
import { chatJSON, isLLMConfigured, LLMUnavailableError } from "@/lib/llm/openrouter";
import { categoriseSystemPrompt, categoriseUserPrompt } from "@/lib/llm/prompts";
import { routeLimiters } from "@/lib/llm/rate-limit";
import {
  categoriseOutputSchema,
  categoriseRequestSchema,
  categoriseWireSchema,
  normaliseCategoriseResults,
} from "@/lib/llm/schemas";
import type { CategoriseResponse } from "@/lib/types";

export const maxDuration = 45;

const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /api/categorise
 * Body: CategoriseRequest `{ locale, items: [{ key, description, amount }] }` (≤ 120 items).
 * 200 → CategoriseResponse `{ results: [{ key, category, merchant? }] }` (keys the model skipped are omitted).
 * 503 `{ error: "llm_unavailable" }` without API key, 502 `{ error: "llm_failed" }`, 429, 400, 413.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isLLMConfigured()) return jsonError(503, "llm_unavailable");

  const limited = enforceRateLimit(routeLimiters.categorise, request);
  if (limited) return limited;

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = categoriseRequestSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "invalid_request");
  const { items } = parsed.data;

  try {
    const out = await chatJSON({
      label: "categorise",
      system: categoriseSystemPrompt(),
      user: categoriseUserPrompt(items),
      schema: categoriseOutputSchema,
      wireSchema: categoriseWireSchema,
      schemaName: "categorisation",
      temperature: 0,
      maxTokens: Math.min(8_000, 400 + items.length * 50),
      signal: request.signal,
    });
    const response: CategoriseResponse = normaliseCategoriseResults(
      out.results,
      items.map((i) => i.key),
    );
    return json(response);
  } catch (err) {
    if (err instanceof LLMUnavailableError) return jsonError(503, "llm_unavailable");
    return jsonError(502, "llm_failed");
  }
}
