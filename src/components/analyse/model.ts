import type { Analysis, Insights, ParseResult, Transaction } from "@/lib/types";

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
  insights: Insights | null;
  insightsLoading: boolean;
  /** Version of the analysis the current insights were computed from. */
  insightsVersion: number;
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
  | { type: "insights"; insights: Insights; version: number }
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
        insights: null,
        insightsLoading: true,
        insightsVersion: 0,
      };
    case "insightsLoading":
      return state.phase === "dashboard" ? { ...state, insightsLoading: true } : state;
    case "insightsFailed":
      return state.phase === "dashboard" ? { ...state, insightsLoading: false } : state;
    case "insights":
      return state.phase === "dashboard"
        ? { ...state, insights: action.insights, insightsLoading: false, insightsVersion: action.version }
        : state;
    case "recategorised":
      return state.phase === "dashboard"
        ? { ...state, transactions: action.transactions, analysis: action.analysis, version: state.version + 1 }
        : state;
    case "reset":
      return initialState;
  }
}

/* ---------------------------------------------------------------- merchants */

/** Display name for a booking: cleaned counterparty, else the raw booking text. */
export function merchantName(tx: Transaction): string {
  return tx.counterparty?.trim() || tx.description.trim();
}
