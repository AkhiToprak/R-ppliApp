import { enforceRateLimit, json, jsonError, readJsonBody } from "@/lib/llm/http";
import { chatJSON, isLLMConfigured } from "@/lib/llm/openrouter";
import { translateSystemPrompt, translateUserPrompt } from "@/lib/llm/prompts";
import { routeLimiters } from "@/lib/llm/rate-limit";
import { applyTranslation, insightTexts, translateRequestSchema, translationOutputSchema, translationWireSchema } from "@/lib/llm/schemas";
import type { Insights } from "@/lib/types";

export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /api/translate
 * Body: `{ locale, insights }` (≤ 64 KB) — model insights to translate into `locale`.
 * Called lazily, when the user switches the language of a finished analysis.
 * 200 → Insights with translated texts (numbers, ids and order unchanged).
 * 503 (no API key), 502 (model failure), 429 (rate limit), 400 (invalid body), 413 (too large).
 */
export async function POST(request: Request): Promise<Response> {
  const limited = enforceRateLimit(routeLimiters.translate, request);
  if (limited) return limited;

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = translateRequestSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "invalid_request");
  const { locale, insights } = parsed.data;

  if (!isLLMConfigured()) return jsonError(503, "llm_unavailable");

  try {
    const out = await chatJSON({
      label: "translate",
      system: translateSystemPrompt(locale),
      user: translateUserPrompt(insightTexts(insights)),
      schema: translationOutputSchema(insights),
      wireSchema: translationWireSchema,
      schemaName: "insights_translation",
      temperature: 0.2,
      maxTokens: 2_500,
      signal: request.signal,
    });
    return json(applyTranslation(insights, out, locale) satisfies Insights);
  } catch {
    return jsonError(502, "llm_failed");
  }
}
