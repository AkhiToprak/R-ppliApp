import { buildFallbackInsights } from "@/lib/llm/fallback-insights";
import { enforceRateLimit, json, jsonError, readJsonBody } from "@/lib/llm/http";
import { chatJSON, isLLMConfigured } from "@/lib/llm/openrouter";
import { insightsSystemPrompt, insightsUserPrompt } from "@/lib/llm/prompts";
import { routeLimiters } from "@/lib/llm/rate-limit";
import { finaliseInsights, insightsOutputSchema, insightsRequestSchema, insightsWireSchema } from "@/lib/llm/schemas";
import type { InsightsResponse } from "@/lib/types";

export const maxDuration = 60;

const MAX_BODY_BYTES = 200 * 1024;

/**
 * POST /api/insights
 * Body: InsightsRequest `{ locale, analysis }` (≤ 200 KB).
 * 200 → Insights (`source: "llm"`, or `source: "fallback"` without API key / on model failure).
 * 429 (rate limit), 400 (invalid body), 413 (too large).
 */
export async function POST(request: Request): Promise<Response> {
  const limited = enforceRateLimit(routeLimiters.insights, request);
  if (limited) return limited;

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = insightsRequestSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "invalid_request");
  const { locale, analysis } = parsed.data;

  const fallback = buildFallbackInsights(analysis, locale);
  if (!isLLMConfigured() || analysis.transactionCount === 0) return json(fallback satisfies InsightsResponse);

  try {
    const out = await chatJSON({
      label: "insights",
      system: insightsSystemPrompt(locale, new Date().toISOString().slice(0, 10)),
      user: insightsUserPrompt(analysis),
      schema: insightsOutputSchema,
      wireSchema: insightsWireSchema,
      schemaName: "budget_insights",
      temperature: 0.6,
      maxTokens: 2_500,
      signal: request.signal,
    });
    const months = analysis.months > 0 ? analysis.months : 1;
    const insights: InsightsResponse = finaliseInsights(out, {
      locale,
      monthlySpending: Math.max(0, analysis.totalSpending) / months,
      fallback,
    });
    return json(insights);
  } catch {
    return json(fallback satisfies InsightsResponse);
  }
}
