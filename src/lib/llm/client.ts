import type { Analysis, ExtractResponse, Insights, Locale } from "@/lib/types";

// CONTRACT (owned by the LLM agent): browser-side wrappers around the API routes.
// fetchInsights never throws: on failure it returns a locally computed fallback (source: "fallback").
export async function fetchInsights(analysis: Analysis, locale: Locale): Promise<Insights> {
  void analysis;
  void locale;
  throw new Error("fetchInsights: not implemented");
}

// Sends redacted PDF text to /api/extract. Throws on failure.
export async function extractFromText(text: string): Promise<ExtractResponse> {
  void text;
  throw new Error("extractFromText: not implemented");
}
