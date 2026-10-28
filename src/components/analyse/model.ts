import type { Analysis, Insights, Locale, ParseResult, Transaction } from "@/lib/types";

/* ---------------------------------------------------------------- errors */

export const ERROR_CODES = [
  "unsupported_format",
  "empty",
  "no_transactions",
  "pdf_extraction_failed",
  "file_too_large",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number] | "unknown";

/** Duck-types `StatementParseError.code` without importing the class. */
export function errorCodeOf(error: unknown): ErrorCode {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : "unknown";
}

/* ---------------------------------------------------------------- state machine */

export type Source = { kind: "file"; file: File } | { kind: "sample" };
export type Stage = "read" | "categorise" | "analyse";

export interface StatementMeta {
  format: ParseResult["format"];
  bank?: string;
  currency: string;
  fileName?: string;
}

export interface DashboardState {
  phase: "dashboard";
  meta: StatementMeta;
  transactions: Transaction[];
  analysis: Analysis;
  /** Bumped on every local re-analysis (recategorisation). */
  version: number;
  /**
   * Insights per language. The first entry is the original (generated in the language active at
   * the time); other languages are translated from it lazily, when the user switches to them.
   */
  insights: Partial<Record<Locale, Insights>>;
  insightsLoading: boolean;
  /** Version of the analysis the current insights were computed from. */
  insightsVersion: number;
  /** Analysis the current insights were computed from (fallback insights are rebuilt from it per language). */
  insightsAnalysis: Analysis | null;
  /** Bumped for every new set of insights, so late translations of an older set are dropped. */
  insightsId: number;
  translating: Locale[];
  translationFailed: Locale[];
}

export type State =
  | { phase: "upload" }
  | { phase: "processing"; stage: Stage; progress: { done: number; total: number } | null; source: Source }
  | { phase: "error"; code: ErrorCode; source: Source }
  | DashboardState;

export type Action =
  | { type: "start"; source: Source }
  | { type: "stage"; stage: Stage }
  | { type: "progress"; done: number; total: number }
  | { type: "fail"; code: ErrorCode }
  | { type: "ready"; meta: StatementMeta; transactions: Transaction[]; analysis: Analysis }
  | { type: "insightsLoading" }
  | { type: "insightsFailed" }
  | { type: "insights"; insights: Insights; locale: Locale; version: number; analysis: Analysis }
  | { type: "translating"; locale: Locale }
  | { type: "translated"; locale: Locale; insights: Insights; id: number }
  | { type: "translationFailed"; locale: Locale; id: number }
  | { type: "retryTranslation"; locale: Locale }
  | { type: "recategorised"; transactions: Transaction[]; analysis: Analysis }
  | { type: "reset" };

export const initialState: State = { phase: "upload" };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { phase: "processing", stage: "read", progress: null, source: action.source };
    case "stage":
      return state.phase === "processing" ? { ...state, stage: action.stage, progress: null } : state;
    case "progress":
      return state.phase === "processing" ? { ...state, progress: { done: action.done, total: action.total } } : state;
    case "fail":
      return state.phase === "processing" ? { phase: "error", code: action.code, source: state.source } : state;
    case "ready":
      return {
        phase: "dashboard",
        meta: action.meta,
        transactions: action.transactions,
        analysis: action.analysis,
        version: 0,
        insights: {},
        insightsLoading: true,
        insightsVersion: 0,
        insightsAnalysis: null,
        insightsId: 0,
        translating: [],
        translationFailed: [],
      };
    case "insightsLoading":
      return state.phase === "dashboard" ? { ...state, insightsLoading: true } : state;
    case "insightsFailed":
      return state.phase === "dashboard" ? { ...state, insightsLoading: false } : state;
    case "insights":
      return state.phase === "dashboard"
        ? {
            ...state,
            insights: { [action.locale]: action.insights },
            insightsLoading: false,
            insightsVersion: action.version,
            insightsAnalysis: action.analysis,
            insightsId: state.insightsId + 1,
            translating: [],
            translationFailed: [],
          }
        : state;
    case "translating":
      return state.phase === "dashboard" && !state.translating.includes(action.locale)
        ? { ...state, translating: [...state.translating, action.locale] }
        : state;
    case "translated":
      return state.phase === "dashboard" && state.insightsId === action.id
        ? {
            ...state,
            insights: { ...state.insights, [action.locale]: action.insights },
            translating: state.translating.filter((l) => l !== action.locale),
          }
        : state;
    case "translationFailed":
      return state.phase === "dashboard" && state.insightsId === action.id
        ? {
            ...state,
            translating: state.translating.filter((l) => l !== action.locale),
            translationFailed: [...state.translationFailed, action.locale],
          }
        : state;
    case "retryTranslation":
      return state.phase === "dashboard"
        ? { ...state, translationFailed: state.translationFailed.filter((l) => l !== action.locale) }
        : state;
    case "recategorised":
      return state.phase === "dashboard"
        ? { ...state, transactions: action.transactions, analysis: action.analysis, version: state.version + 1 }
        : state;
    case "reset":
      return initialState;
  }
}

/* ---------------------------------------------------------------- insights per language */

/** The original insights and their language, i.e. what other languages are translated from. */
export function originalInsights(state: DashboardState): { locale: Locale; insights: Insights } | null {
  const locale = (Object.keys(state.insights) as Locale[])[0];
  const insights = locale && state.insights[locale];
  return insights ? { locale, insights } : null;
}

/**
 * What to show in `locale`: its own insights, or — until the translation arrives — the original
 * ones, whose texts the UI renders as "translating" skeletons.
 */
export function insightsIn(state: DashboardState, locale: Locale) {
  const own = state.insights[locale];
  if (own) return { insights: own, translating: false, translationFailed: false };
  const original = originalInsights(state);
  const failed = state.translationFailed.includes(locale);
  return { insights: original?.insights ?? null, translating: !!original && !failed, translationFailed: !!original && failed };
}

/* ---------------------------------------------------------------- merchants */

/** Display name for a booking: cleaned counterparty, else the raw booking text. */
export function merchantName(tx: Transaction): string {
  return tx.counterparty?.trim() || tx.description.trim();
}
