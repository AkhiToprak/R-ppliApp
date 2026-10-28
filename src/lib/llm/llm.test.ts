import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Analysis, Insights, Locale } from "@/lib/types";
import { analyse } from "@/lib/analysis";
import { buildFallbackInsights, fallbackScore } from "./fallback-insights";
import { extractJSON, repairTruncatedJSON } from "./json";
import { chatJSON, LLMUnavailableError } from "./openrouter";
import { createRateLimiter } from "./rate-limit";
import {
  analysisSchema,
  categoriseRequestSchema,
  coerceCategory,
  finaliseInsights,
  insightsOutputSchema,
  normaliseAmount,
  normaliseCategoriseResults,
  normaliseDate,
  normaliseExtracted,
} from "./schemas";

const LOCALES: Locale[] = ["de", "fr", "it", "en"];

// ---- fixtures -------------------------------------------------------------------

function emptyAnalysis(): Analysis {
  return {
    currency: "CHF",
    period: { from: "2025-01-01", to: "2025-01-01" },
    months: 1,
    totalIncome: 0,
    totalSpending: 0,
    totalSaved: 0,
    net: 0,
    savingsRate: null,
    dailyAverageSpending: 0,
    byCategory: [],
    byMonth: [],
    topMerchants: [],
    recurring: [],
    largestExpenses: [],
    weekdaySpending: [0, 0, 0, 0, 0, 0, 0],
    transactionCount: 0,
  };
}

function sampleAnalysis(over: Partial<Analysis> = {}): Analysis {
  const months = 3;
  const cats: [Analysis["byCategory"][number]["category"], number][] = [
    ["housing", 1900],
    ["groceries", 820],
    ["restaurants", 610],
    ["insurance", 430],
    ["subscriptions", 95],
    ["telecom", 79],
    ["transport", 160],
    ["shopping", 300],
    ["fees", 12],
    ["cash", 150],
  ];
  const totalSpendingMonthly = cats.reduce((s, [, v]) => s + v, 0);
  const income = 7000;
  return {
    currency: "CHF",
    period: { from: "2025-01-01", to: "2025-03-31" },
    months,
    totalIncome: income * months,
    totalSpending: totalSpendingMonthly * months,
    totalSaved: 600 * months,
    net: (income - totalSpendingMonthly - 600) * months,
    savingsRate: (income - totalSpendingMonthly) / income,
    dailyAverageSpending: (totalSpendingMonthly * months) / 90,
    byCategory: [
      ...cats.map(([category, monthly]) => ({
        category,
        total: monthly * months,
        count: 10,
        share: monthly / totalSpendingMonthly,
        monthlyAverage: monthly,
      })),
      { category: "income" as const, total: income * months, count: 3, share: 0, monthlyAverage: income },
      { category: "savings" as const, total: 1800, count: 3, share: 0, monthlyAverage: 600 },
    ],
    byMonth: [
      { month: "2025-01", income, spending: totalSpendingMonthly, saved: 600, byCategory: { groceries: 820 } },
      { month: "2025-02", income, spending: totalSpendingMonthly, saved: 600, byCategory: { groceries: 800 } },
    ],
    topMerchants: [
      { name: "Migros", category: "groceries", total: 1500, count: 30 },
      { name: "Uber Eats", category: "restaurants", total: 900, count: 25 },
      { name: "Swisscom", category: "telecom", total: 237, count: 3 },
    ],
    recurring: [
      { name: "Netflix", category: "subscriptions", amount: 20.9, frequency: "monthly", monthlyCost: 20.9, occurrences: 3 },
      { name: "Spotify", category: "subscriptions", amount: 13.95, frequency: "monthly", monthlyCost: 13.95, occurrences: 3 },
      { name: "Miete", category: "housing", amount: 1900, frequency: "monthly", monthlyCost: 1900, occurrences: 3 },
    ],
    largestExpenses: [
      { id: "t1", date: "2025-01-01", description: "Miete Januar", amount: -1900, currency: "CHF", category: "housing" },
    ],
    weekdaySpending: [100, 120, 90, 110, 300, 400, 200],
    transactionCount: 214,
    ...over,
  };
}

function expectValidInsights(i: Insights) {
  expect(typeof i.personaText).toBe("string");
  expect(i.personaText.length).toBeGreaterThan(10);
  expect(i.score).toBeGreaterThanOrEqual(0);
  expect(i.score).toBeLessThanOrEqual(100);
  expect(Number.isInteger(i.score)).toBe(true);
  expect(i.persona.length).toBeGreaterThan(0);
  expect(i.source).toBe("fallback");
  expect(i.strengths.length).toBeLessThanOrEqual(4);
  expect(i.weaknesses.length).toBeLessThanOrEqual(4);
  expect(i.critiques.length).toBeLessThanOrEqual(5);
  expect(i.savings.length).toBeLessThanOrEqual(5);
  for (const item of [...i.strengths, ...i.weaknesses, ...i.critiques, ...i.savings]) {
    expect(item.title.length).toBeGreaterThan(0);
    expect(item.detail.length).toBeGreaterThan(0);
    expect(item.title + item.detail).not.toMatch(/undefined|NaN|\{\w+\}/);
  }
  for (const s of i.savings) {
    expect(s.monthlySaving).toBeGreaterThan(0);
    expect(["easy", "medium", "hard"]).toContain(s.effort);
  }
  for (const c of i.critiques) {
    expect(c.target.length).toBeGreaterThan(0);
    expect(c.suggestion.length).toBeGreaterThan(0);
  }
}

// ---- JSON parsing -------------------------------------------------------------------

describe("extractJSON", () => {
  it("parses plain JSON", () => {
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json fences and surrounding prose", () => {
    expect(extractJSON('Here you go:\n```json\n{"results":[{"key":"1"}]}\n```\nHope that helps')).toEqual({ results: [{ key: "1" }] });
    expect(extractJSON('```\n{"a":true}\n```')).toEqual({ a: true });
  });

  it("finds an object embedded in text", () => {
    expect(extractJSON('Sure! {"x": [1, 2]} — done.')).toEqual({ x: [1, 2] });
  });

  it("tolerates trailing commas", () => {
    expect(extractJSON('{"a":[1,2,],"b":{"c":3,},}')).toEqual({ a: [1, 2], b: { c: 3 } });
  });

  it("keeps commas inside strings", () => {
    expect(extractJSON('{"a":"x,}",}')).toEqual({ a: "x,}" });
  });

  it("repairs a truncated reply by dropping the incomplete last row", () => {
    const truncated = '```json\n{"currency":"CHF","transactions":[{"d":"2025-01-01","a":-1},{"d":"2025-01-02","a":-2},{"d":"2025-01-0';
    expect(extractJSON(truncated)).toEqual({ currency: "CHF", transactions: [{ d: "2025-01-01", a: -1 }, { d: "2025-01-02", a: -2 }] });
  });

  it("repairTruncatedJSON gives up on garbage", () => {
    expect(repairTruncatedJSON("{{{{").ok).toBe(false);
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJSON("I cannot help with that.")).toThrow(SyntaxError);
  });
});

// ---- categorise coercion ----------------------------------------------------------

describe("categorise schemas", () => {
  it("coerces unknown categories to other", () => {
    expect(coerceCategory("Groceries ")).toBe("groceries");
    expect(coerceCategory("food")).toBe("other");
    expect(coerceCategory(42)).toBe("other");
    expect(coerceCategory(null)).toBe("other");
  });

  it("normalises rows, drops unknown keys and duplicates", () => {
    const res = normaliseCategoriseResults(
      [
        { key: "a", category: "GROCERIES", merchant: "  Migros  " },
        { key: "b", category: "dining", merchant: "" },
        { key: "a", category: "shopping", merchant: "dup" },
        { key: "zzz", category: "groceries" },
        { category: "groceries" },
        "nonsense",
        { key: 3, category: "taxes", merchant: null },
      ],
      ["a", "b", "3"],
    );
    expect(res.results).toEqual([
      { key: "a", category: "groceries", merchant: "Migros" },
      { key: "b", category: "other" },
      { key: "3", category: "taxes" },
    ]);
  });

  it("validates the request (max 120 items, locale, truncates long descriptions)", () => {
    const item = { key: "k", description: "x".repeat(300), amount: -5 };
    const ok = categoriseRequestSchema.safeParse({ locale: "de", items: [item] });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.items[0].description).toHaveLength(200);
    expect(categoriseRequestSchema.safeParse({ locale: "es", items: [item] }).success).toBe(false);
    expect(categoriseRequestSchema.safeParse({ locale: "de", items: Array(121).fill(item) }).success).toBe(false);
    expect(categoriseRequestSchema.safeParse({ locale: "de", items: [] }).success).toBe(false);
  });
});

// ---- insights output ----------------------------------------------------------------

describe("insights output schema", () => {
  const fallback = buildFallbackInsights(sampleAnalysis(), "de");

  it("clamps score, trims lists, coerces categories and fixes ß", () => {
    const raw = {
      score: 140,
      persona: "Sparfuchs",
      personaText: "Du machst das **gut**, weiter so mit dem Sparen. Grüße gibt es keine.",
      strengths: Array.from({ length: 6 }, (_, i) => ({ title: `S${i}`, detail: "gut" })),
      weaknesses: [{ title: "W", detail: "Straße" }, { nope: true }],
      critiques: [{ title: "Uber Eats", detail: "viel", target: "Uber Eats", category: "food", amount: "203", suggestion: "kochen" }],
      savings: [
        { title: "A", detail: "a", monthlySaving: 50000, effort: "trivial" },
        { title: "B", detail: "b", monthlySaving: -5, effort: "easy" },
      ],
    };
    const out = insightsOutputSchema.parse(raw);
    expect(out.score).toBe(100);
    expect(out.strengths).toHaveLength(4);
    expect(out.weaknesses).toHaveLength(1);
    expect(out.critiques[0].category).toBeUndefined();
    expect(out.critiques[0].amount).toBe(203);
    expect(out.savings[0].effort).toBe("medium");

    const final = finaliseInsights(out, { locale: "de", monthlySpending: 4000, fallback });
    expect(final.source).toBe("llm");
    expect(final.personaText).not.toMatch(/ß|\*\*/);
    expect(final.weaknesses[0].detail).toBe("Strasse");
    expect(final.savings).toHaveLength(1); // the negative one is dropped
    expect(final.savings[0].monthlySaving).toBe(4000); // capped to monthly spending
  });

  it("tops up empty lists from the fallback", () => {
    const out = insightsOutputSchema.parse({ score: 70, persona: "X", personaText: "Alles im grünen Bereich.", strengths: "oops" });
    const final = finaliseInsights(out, { locale: "de", monthlySpending: 4000, fallback });
    expect(final.strengths).toEqual(fallback.strengths);
    expect(final.savings).toEqual(fallback.savings);
  });

  it("rejects output without a persona text", () => {
    expect(insightsOutputSchema.safeParse({ score: 50, persona: "x" }).success).toBe(false);
  });
});

// ---- fallback insights ---------------------------------------------------------------

describe("buildFallbackInsights", () => {
  it.each(LOCALES)("produces valid insights for a typical analysis (%s)", (locale) => {
    const i = buildFallbackInsights(sampleAnalysis(), locale);
    expectValidInsights(i);
    expect(i.strengths.length).toBeGreaterThanOrEqual(1);
    expect(i.weaknesses.length).toBeGreaterThanOrEqual(1);
    expect(i.critiques.length).toBeGreaterThanOrEqual(3);
    expect(i.savings.length).toBeGreaterThanOrEqual(3);
    expect(i.personaText.length).toBeGreaterThan(10);
    if (locale === "de") expect(JSON.stringify(i)).not.toContain("ß");
  });

  it.each(LOCALES)("handles an empty analysis (%s)", (locale) => {
    const i = buildFallbackInsights(emptyAnalysis(), locale);
    expectValidInsights(i);
    expect(i.score).toBe(50);
    expect(i.critiques).toEqual([]);
  });

  it("praises a savings rate ≥ 20 % and penalises a deficit", () => {
    const good = buildFallbackInsights(sampleAnalysis({ totalIncome: 12000 * 3, savingsRate: 0.62 }), "de");
    expect(good.persona).toBe("Sparfuchs");
    expect(good.strengths[0].title).toBe("Starke Sparquote");

    const bad = sampleAnalysis({ totalIncome: 3000 * 3, savingsRate: (3000 - 4556) / 3000 });
    expect(fallbackScore(bad)).toBeLessThan(40);
    expect(buildFallbackInsights(bad, "en").weaknesses[0].title).toBe("More out than in");
  });

  it("works without income", () => {
    const i = buildFallbackInsights(sampleAnalysis({ totalIncome: 0, savingsRate: null }), "fr");
    expectValidInsights(i);
    expect(i.weaknesses[0].title).toBe("Aucun revenu visible");
  });

  it("names the top merchant in critiques", () => {
    const i = buildFallbackInsights(sampleAnalysis(), "en");
    expect(i.critiques.some((c) => c.target === "Uber Eats" || c.target === "Migros")).toBe(true);
  });

  it("the fixture passes the request schema", () => {
    expect(analysisSchema.safeParse(sampleAnalysis()).success).toBe(true);
    expect(analysisSchema.safeParse(emptyAnalysis()).success).toBe(true);
  });
});

// ---- extract normalisation --------------------------------------------------------------

describe("extract normalisation", () => {
  it("normalises dates and amounts", () => {
    expect(normaliseDate("31.01.2025")).toBe("2025-01-31");
    expect(normaliseDate("1.2.25")).toBe("2025-02-01");
    expect(normaliseDate("2025-02-30")).toBeNull();
    expect(normaliseDate("yesterday")).toBeNull();
    expect(normaliseAmount("-1'234.50")).toBe(-1234.5);
    expect(normaliseAmount("45,20")).toBe(45.2);
    expect(normaliseAmount("45.20-")).toBe(-45.2);
    expect(normaliseAmount(0)).toBeNull();
  });

  it("drops invalid rows", () => {
    const res = normaliseExtracted({
      currency: "chf",
      bank: "UBS",
      transactions: [
        { d: "2025-01-03", t: " Migros  Zürich ", p: "Migros", a: -45.2 },
        { d: "03.01.2025", t: "Lohn", p: "", a: "6'500.00" },
        { d: "bad", t: "x", a: -1 },
        { d: "2025-01-04", t: "", a: -1 },
        { d: "2025-01-05", t: "Zero", a: 0 },
        null,
      ],
    });
    expect(res.currency).toBe("CHF");
    expect(res.bank).toBe("UBS");
    expect(res.transactions).toEqual([
      { date: "2025-01-03", description: "Migros Zürich", counterparty: "Migros", amount: -45.2, currency: "CHF" },
      { date: "2025-01-03", description: "Lohn", amount: 6500, currency: "CHF" },
    ]);
  });
});

// ---- rate limiter ----------------------------------------------------------------------

describe("createRateLimiter", () => {
  it("allows `limit` requests per sliding window per key", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(rl.check("ip", 0).ok).toBe(true);
    expect(rl.check("ip", 100).ok).toBe(true);
    const third = rl.check("ip", 200);
    expect(third).toMatchObject({ ok: true, remaining: 0 });
    const blocked = rl.check("ip", 300);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(700);
    expect(rl.check("other", 300).ok).toBe(true);
    // first hit (t=0) leaves the window at t=1000
    expect(rl.check("ip", 1001).ok).toBe(true);
    expect(rl.check("ip", 1002).ok).toBe(false);
  });

  it("evicts keys beyond maxKeys", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 10 });
    for (let i = 0; i < 50; i++) rl.check(`k${i}`, i);
    expect(rl.size()).toBeLessThanOrEqual(10);
  });
});

// ---- chatJSON (fetch mocked, no network) ----------------------------------------------------

describe("chatJSON", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const completion = (content: string) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { "Content-Type": "application/json" } });

  it("throws LLMUnavailableError without a key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(chatJSON({ system: "s", user: "u", schema: z.object({}) })).rejects.toBeInstanceOf(LLMUnavailableError);
  });

  it("retries once with the validation error and falls back to json_object on 400", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "test/model-a");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const bodies: Record<string, unknown>[] = [];
    const replies = [
      new Response("{}", { status: 400 }), // json_schema rejected
      completion('```json\n{"n":"not a number"}\n```'), // invalid → retry
      completion('{"n": 4}'),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return replies.shift()!;
      }),
    );
    const result = await chatJSON({ system: "s", user: "u", schema: z.object({ n: z.number() }) });
    expect(result).toEqual({ n: 4 });
    expect(bodies).toHaveLength(3);
    expect((bodies[0].response_format as { type: string }).type).toBe("json_schema");
    expect((bodies[1].response_format as { type: string }).type).toBe("json_object");
    const retryMessages = bodies[2].messages as { role: string; content: string }[];
    expect(retryMessages).toHaveLength(4);
    expect(retryMessages[3].content).toMatch(/did not match the required schema/);
    expect(bodies[0].provider).toEqual({ data_collection: "deny" });
  });
});

describe("finaliseInsights target localisation", () => {
  it("replaces category ids and English labels with the locale label", async () => {
    const { finaliseInsights } = await import("./schemas");
    const fallback = buildFallbackInsights(analyse([]), "fr");
    const base = { score: 50, persona: "p", personaText: "s", strengths: [], weaknesses: [], savings: [] };
    const crit = (target: string) => ({ title: "t", detail: "d", target, suggestion: "x" });
    const out = finaliseInsights(
      { ...base, critiques: [crit("travel"), crit("Subscriptions"), crit("CSS Kranken-Versicherung AG")] } as never,
      { locale: "fr", monthlySpending: 1000, fallback },
    );
    expect(out.critiques.map((c) => c.target)).toEqual(["Voyages & vacances", "Abonnements & streaming", "CSS Kranken-Versicherung AG"]);
  });
});
