// Shared domain types. This file is the contract between parsers, categoriser,
// analysis, LLM routes and UI — change it only in coordination.

export type Locale = "de" | "fr" | "it" | "en";

export const CATEGORY_IDS = [
  "groceries",
  "restaurants",
  "transport",
  "car",
  "housing",
  "utilities",
  "telecom",
  "insurance",
  "health",
  "shopping",
  "leisure",
  "subscriptions",
  "travel",
  "education",
  "children",
  "taxes",
  "fees",
  "cash",
  "savings",
  "transfers",
  "income",
  "other",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Categories that are not consumption spending (excluded from "spending" charts). */
export const NON_SPENDING_CATEGORIES: readonly CategoryId[] = [
  "income",
  "savings",
  "transfers",
];

export type CategorySource = "rule" | "llm" | "fallback";

export interface Transaction {
  id: string;
  /** ISO date, YYYY-MM-DD (booking date). */
  date: string;
  /** Raw booking text as found in the statement. */
  description: string;
  /** Cleaned merchant / counterparty name, if it could be derived. */
  counterparty?: string;
  /** Signed amount in statement currency. Negative = money out, positive = money in. */
  amount: number;
  /** ISO 4217, e.g. "CHF". */
  currency: string;
  category?: CategoryId;
  categorySource?: CategorySource;
}

export type StatementFormat = "csv" | "camt" | "xlsx" | "pdf" | "sample";

export interface ParseResult {
  transactions: Transaction[];
  format: StatementFormat;
  /** Detected bank, e.g. "UBS", "PostFinance", "Raiffeisen", "ZKB", "Revolut", "neon", "Yuh". */
  bank?: string;
  /** Dominant currency of the statement. */
  currency: string;
  /** Non-fatal issues (skipped rows etc.), as short English developer strings. */
  warnings: string[];
}

export interface CategoryTotal {
  category: CategoryId;
  /** Positive number: total outflow (or inflow for income) in CHF. */
  total: number;
  count: number;
  /** Share of total spending, 0..1 (0 for non-spending categories). */
  share: number;
  /** Average per month over the statement period (not meaningful when `isSingleMonth`). */
  monthlyAverage: number;
  /** Distinct calendar months with at least one booking that adds to the total. */
  months: number;
}

export interface MonthlySummary {
  /** YYYY-MM */
  month: string;
  income: number;
  /** Positive number. Consumption spending only (excludes NON_SPENDING_CATEGORIES). */
  spending: number;
  /** Positive number. Money moved to savings / investments. */
  saved: number;
  byCategory: Partial<Record<CategoryId, number>>;
}

export interface MerchantTotal {
  name: string;
  category: CategoryId;
  total: number;
  count: number;
  /** Distinct calendar months with at least one purchase (1 = one-off, not a monthly cost). */
  months: number;
}

export interface RecurringPayment {
  name: string;
  category: CategoryId;
  /** Typical amount per occurrence, positive. */
  amount: number;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  /** Normalised cost per month, positive. */
  monthlyCost: number;
  occurrences: number;
}

export interface Analysis {
  currency: string;
  period: { from: string; to: string };
  /** Length of the period in months (fractional, min 1). */
  months: number;
  totalIncome: number;
  totalSpending: number;
  totalSaved: number;
  /** totalIncome - totalSpending - totalSaved */
  net: number;
  /** (income - spending) / income, 0..1, null if no income. */
  savingsRate: number | null;
  dailyAverageSpending: number;
  /** Sorted descending by total. Spending categories plus income/savings/transfers. */
  byCategory: CategoryTotal[];
  /** Chronological. */
  byMonth: MonthlySummary[];
  /** Top 10 spending merchants, descending. */
  topMerchants: MerchantTotal[];
  recurring: RecurringPayment[];
  /** Top 5 single outflows, most negative first. */
  largestExpenses: Transaction[];
  /** Spending by weekday, index 0 = Monday. */
  weekdaySpending: number[];
  transactionCount: number;
}

export interface InsightItem {
  title: string;
  detail: string;
}

export interface Critique extends InsightItem {
  /** The merchant or category the critique is about. */
  target: string;
  category?: CategoryId;
  /** Monthly amount concerned, CHF. */
  amount?: number;
  suggestion: string;
}

export interface SavingOption extends InsightItem {
  /** Estimated achievable saving per month, CHF. */
  monthlySaving: number;
  effort: "easy" | "medium" | "hard";
}

export interface Insights {
  /** 0..100 budget health score. */
  score: number;
  /** One-word or short label for the score, e.g. "Sparfuchs". */
  persona: string;
  /** One short, general sentence explaining the persona type. */
  personaText: string;
  strengths: InsightItem[];
  weaknesses: InsightItem[];
  critiques: Critique[];
  savings: SavingOption[];
  /** "llm" when produced by the model, "fallback" when computed locally. */
  source: "llm" | "fallback";
}

// ---- API contracts ---------------------------------------------------------

export interface CategoriseRequest {
  locale: Locale;
  items: { key: string; description: string; amount: number }[];
}
export interface CategoriseResponse {
  results: { key: string; category: CategoryId; merchant?: string }[];
}

export interface InsightsRequest {
  locale: Locale;
  analysis: Analysis;
}
export type InsightsResponse = Insights;

export interface ExtractRequest {
  /** Plain text of a PDF statement (already redacted client-side). */
  text: string;
}
export interface ExtractResponse {
  transactions: Omit<Transaction, "id" | "category" | "categorySource">[];
  currency: string;
  bank?: string;
}

/**
 * Seen in only one calendar month of a multi-month statement (a hotel stay, a
 * yearly bill): a per-month average would invent a cost that doesn't recur, so
 * show the actual amount instead.
 */
export function isSingleMonth(item: { months: number }, analysis: Pick<Analysis, "byMonth">): boolean {
  return analysis.byMonth.length > 1 && item.months < 2;
}

/** First month (YYYY-MM) with spending in `category`; for single-month categories, the only one. */
export function firstMonthOf(category: CategoryId, analysis: Pick<Analysis, "byMonth">): string | undefined {
  return analysis.byMonth.find((m) => (m.byCategory[category] ?? 0) > 0)?.month;
}
