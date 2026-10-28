// Zod schemas for the LLM API routes: request validation, lenient model-output
// parsing (with coercion) and clean "wire" schemas used for structured output.

import { z } from "zod";
import {
  CATEGORY_IDS,
  type Analysis,
  type CategoryId,
  type CategoriseResponse,
  type Critique,
  type ExtractResponse,
  type InsightItem,
  type Insights,
  type SavingOption,
} from "@/lib/types";

export const localeSchema = z.enum(["de", "fr", "it", "en"]);

const CATEGORY_SET = new Set<string>(CATEGORY_IDS);
export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

/** Lower-cases / trims and maps anything unknown to "other". */
export function coerceCategory(value: unknown): CategoryId {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return isCategoryId(v) ? v : "other";
}

const categoryCoerced = z.unknown().transform(coerceCategory);

/** Trimmed string, cut to `max` chars (never rejected for length). */
const text = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s));

const finiteNumber = z.coerce.number().refine(Number.isFinite, "must be a finite number");

// ---- /api/categorise ---------------------------------------------------------

export const CATEGORISE_MAX_ITEMS = 120;

export const categoriseRequestSchema = z.object({
  locale: localeSchema,
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(200),
        // Hard limit 500, anything above 200 is truncated (the model doesn't need more).
        description: z.string().max(500).transform((s) => s.slice(0, 200)),
        amount: z.number().finite(),
      }),
    )
    .min(1)
    .max(CATEGORISE_MAX_ITEMS),
});

/** What we ask the model for. */
export const categoriseWireSchema = z.object({
  results: z.array(
    z.object({
      key: z.string(),
      category: z.enum(CATEGORY_IDS),
      merchant: z.string(),
    }),
  ),
});

const categoriseItemOutput = z.object({
  key: z.coerce.string(),
  category: categoryCoerced,
  merchant: z
    .string()
    .nullish()
    .transform((m) => {
      const s = m?.replace(/\s+/g, " ").trim();
      return s ? s.slice(0, 60) : undefined;
    }),
});

/** Lenient output: top-level must be `{results: [...]}`, individual bad rows are dropped later. */
export const categoriseOutputSchema = z.object({ results: z.array(z.unknown()) });

/**
 * Validates rows individually, coerces unknown categories to "other",
 * keeps only keys that were requested (first answer wins).
 */
export function normaliseCategoriseResults(rows: unknown[], requestedKeys: Iterable<string>): CategoriseResponse {
  const wanted = new Set(requestedKeys);
  const seen = new Set<string>();
  const results: CategoriseResponse["results"] = [];
  for (const row of rows) {
    const r = categoriseItemOutput.safeParse(row);
    if (!r.success || !wanted.has(r.data.key) || seen.has(r.data.key)) continue;
    seen.add(r.data.key);
    results.push(r.data.merchant ? { key: r.data.key, category: r.data.category, merchant: r.data.merchant } : { key: r.data.key, category: r.data.category });
  }
  return { results };
}

// ---- /api/insights -----------------------------------------------------------

const isoDate = z.string().max(40);
const categoryId = z.enum(CATEGORY_IDS);
const money = z.number().finite();

const transactionSchema = z.object({
  id: z.string().max(200),
  date: isoDate,
  description: z.string().max(1_000),
  counterparty: z.string().max(300).optional(),
  amount: money,
  currency: z.string().max(10),
  category: categoryId.optional(),
  categorySource: z.enum(["rule", "llm", "fallback"]).optional(),
});

export const analysisSchema = z.object({
  currency: z.string().max(10),
  period: z.object({ from: isoDate, to: isoDate }),
  months: z.number().finite().min(0).max(1_200),
  totalIncome: money,
  totalSpending: money,
  totalSaved: money,
  net: money,
  savingsRate: z.number().finite().nullable(),
  dailyAverageSpending: money,
  byCategory: z
    .array(
      z.object({
        category: categoryId,
        total: money,
        count: z.number().finite(),
        share: z.number().finite(),
        monthlyAverage: money,
      }),
    )
    .max(60),
  byMonth: z
    .array(
      z.object({
        month: z.string().max(10),
        income: money,
        spending: money,
        saved: money,
        byCategory: z.partialRecord(categoryId, money),
      }),
    )
    .max(240),
  topMerchants: z
    .array(z.object({ name: z.string().max(300), category: categoryId, total: money, count: z.number().finite() }))
    .max(100),
  recurring: z
    .array(
      z.object({
        name: z.string().max(300),
        category: categoryId,
        amount: money,
        frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
        monthlyCost: money,
        occurrences: z.number().finite(),
      }),
    )
    .max(200),
  largestExpenses: z.array(transactionSchema).max(50),
  weekdaySpending: z.array(money).max(7),
  transactionCount: z.number().finite(),
}) satisfies z.ZodType<Analysis>;

export const insightsRequestSchema = z.object({ locale: localeSchema, analysis: analysisSchema });

const insightItemWire = z.object({ title: z.string(), detail: z.string() });

/** Clean schema for structured output. */
export const insightsWireSchema = z.object({
  summary: z.string(),
  score: z.number().int().min(0).max(100),
  persona: z.string(),
  strengths: z.array(insightItemWire),
  weaknesses: z.array(insightItemWire),
  critiques: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      target: z.string(),
      category: z.enum(CATEGORY_IDS),
      amount: z.number(),
      suggestion: z.string(),
    }),
  ),
  savings: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      monthlySaving: z.number(),
      effort: z.enum(["easy", "medium", "hard"]),
    }),
  ),
});

const optionalPositive = z.unknown().transform((v) => {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.-]/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
});

const insightItemOutput = z.object({ title: text(120), detail: text(600) });

const listOf = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((rows) =>
      rows
        .map((r) => item.safeParse(r))
        .filter((r) => r.success)
        .map((r) => r.data as z.output<T>)
        .slice(0, max),
    );

/** Lenient model output → coerced, clamped, trimmed. */
export const insightsOutputSchema = z.object({
  summary: text(800).pipe(z.string().min(10)),
  score: finiteNumber.transform((n) => Math.round(Math.min(100, Math.max(0, n)))),
  persona: text(40).pipe(z.string().min(1)),
  strengths: listOf(insightItemOutput, 4),
  weaknesses: listOf(insightItemOutput, 4),
  critiques: listOf(
    insightItemOutput.extend({
      target: text(80),
      category: z.unknown().transform((v) => {
        const s = typeof v === "string" ? v.trim().toLowerCase() : "";
        return isCategoryId(s) ? s : undefined;
      }),
      amount: optionalPositive,
      suggestion: text(400),
    }),
    5,
  ),
  savings: listOf(
    insightItemOutput.extend({
      monthlySaving: optionalPositive.transform((n) => n ?? 0),
      effort: z.enum(["easy", "medium", "hard"]).catch("medium"),
    }),
    5,
  ),
});

export type InsightsOutput = z.output<typeof insightsOutputSchema>;

const stripMarkdown = (s: string) => s.replace(/\*\*|__|`/g, "");

/**
 * Final clean-up of model insights: Swiss German "ss", no markdown, savings capped to
 * plausible amounts, empty lists topped up from the rule-based fallback.
 */
export function finaliseInsights(
  out: InsightsOutput,
  ctx: { locale: z.infer<typeof localeSchema>; monthlySpending: number; fallback: Insights },
): Insights {
  const fix = (s: string) => {
    const t = stripMarkdown(s);
    return ctx.locale === "de" ? t.replace(/ß/g, "ss") : t;
  };
  const item = (i: InsightItem): InsightItem => ({ title: fix(i.title), detail: fix(i.detail) });
  const cap = ctx.monthlySpending > 0 ? ctx.monthlySpending : Infinity;

  const critiques: Critique[] = out.critiques.map((c) => {
    const res: Critique = { ...item(c), target: fix(c.target), suggestion: fix(c.suggestion) };
    if (c.category) res.category = c.category;
    if (c.amount !== undefined) res.amount = c.amount;
    return res;
  });
  const savings: SavingOption[] = out.savings
    .map((s) => ({ ...item(s), monthlySaving: Math.round(Math.min(s.monthlySaving, cap)), effort: s.effort }))
    .filter((s) => s.monthlySaving > 0);

  const strengths = out.strengths.map(item);
  const weaknesses = out.weaknesses.map(item);
  return {
    summary: fix(out.summary),
    score: out.score,
    persona: fix(out.persona),
    strengths: strengths.length ? strengths : ctx.fallback.strengths,
    weaknesses: weaknesses.length ? weaknesses : ctx.fallback.weaknesses,
    critiques: critiques.length ? critiques : ctx.fallback.critiques,
    savings: savings.length ? savings : ctx.fallback.savings,
    source: "llm",
  };
}

// ---- /api/extract ------------------------------------------------------------

export const EXTRACT_MAX_CHARS = 60_000;

export const extractRequestSchema = z.object({ text: z.string().trim().min(1).max(EXTRACT_MAX_CHARS) });

/** Compact wire format (short keys keep output tokens down on long statements). */
export const extractWireSchema = z.object({
  currency: z.string(),
  bank: z.string(),
  transactions: z.array(
    z.object({
      d: z.string().describe("booking date YYYY-MM-DD"),
      t: z.string().describe("booking text"),
      p: z.string().describe("counterparty / merchant, empty if unknown"),
      a: z.number().describe("signed amount, debits negative"),
    }),
  ),
});

export const extractOutputSchema = z.object({
  currency: z.unknown().optional(),
  bank: z.unknown().optional(),
  transactions: z.array(z.unknown()),
});

const extractRow = z.object({
  d: z.unknown(),
  t: z.unknown(),
  p: z.unknown().optional(),
  a: z.unknown(),
  c: z.unknown().optional(),
});

/** Accepts YYYY-MM-DD, DD.MM.YYYY, DD.MM.YY, DD/MM/YYYY; returns ISO or null. */
export function normaliseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else return null;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // e.g. 31.02.
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parses numbers like -1'234.50, 1’234,50, "−45.2", "45.20-". */
export function normaliseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value !== 0 ? Math.round(value * 100) / 100 : null;
  if (typeof value !== "string") return null;
  let s = value.trim().replace(/[\s'’`]/g, "").replace(/[−–]/g, "-").replace(/^CHF|CHF$/i, "");
  let negative = false;
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.round((negative ? -Math.abs(n) : n) * 100) / 100;
}

function normaliseCurrency(value: unknown, fallback = "CHF"): string {
  return typeof value === "string" && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}

/** Validates/cleans extracted rows; drops anything without a valid date, text and non-zero amount. */
export function normaliseExtracted(out: z.output<typeof extractOutputSchema>): ExtractResponse {
  const currency = normaliseCurrency(out.currency);
  const transactions: ExtractResponse["transactions"] = [];
  for (const raw of out.transactions) {
    const r = extractRow.safeParse(raw);
    if (!r.success) continue;
    const date = normaliseDate(r.data.d);
    const amount = normaliseAmount(r.data.a);
    const description = typeof r.data.t === "string" ? r.data.t.replace(/\s+/g, " ").trim().slice(0, 300) : "";
    if (!date || amount === null || !description) continue;
    const counterparty = typeof r.data.p === "string" ? r.data.p.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    transactions.push({
      date,
      description,
      ...(counterparty ? { counterparty } : {}),
      amount,
      currency: normaliseCurrency(r.data.c, currency),
    });
  }
  const bank = typeof out.bank === "string" ? out.bank.trim().slice(0, 60) : "";
  return { transactions, currency, ...(bank ? { bank } : {}) };
}
