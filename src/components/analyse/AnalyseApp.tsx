"use client";

import { useCallback, useEffect } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { analyse } from "@/lib/analysis";
import { categoriseTransactions, recategorise } from "@/lib/categorise";
import { useLocale } from "@/lib/i18n/client";
import { fetchInsights, translateInsights } from "@/lib/llm/client";
import { buildFallbackInsights } from "@/lib/llm/fallback-insights";
import { getSampleStatement, parseStatement } from "@/lib/parsers";
import type { Analysis, CategoryId, Locale, ParseResult } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { ErrorStage, ProcessingStage } from "./ProcessingStage";
import { UploadStage } from "./UploadStage";
import { errorCodeOf, originalInsights, type Source } from "./model";
import { currentRunId, dispatch, getActiveLocale, getState, nextRunId, setActiveLocale, useAnalyseState } from "./store";
import { EASE_OUT } from "./ui";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function loadInsights(analysis: Analysis, version: number, locale: Locale, id: number) {
  dispatch({ type: "insightsLoading" });
  try {
    // Contract: never throws (falls back locally) — guarded anyway so the UI can't hang.
    const insights = await fetchInsights(analysis, locale);
    if (currentRunId() === id) dispatch({ type: "insights", insights, locale, version, analysis });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    if (currentRunId() === id) dispatch({ type: "insightsFailed" });
  }
}

/**
 * Brings the insights into `locale`, only once the user actually switches to it. Model insights
 * are translated (texts only — numbers stay); rule-based fallback insights are simply rebuilt.
 */
async function ensureTranslated(locale: Locale) {
  // Read the live state, not a render's snapshot, so a translation is never requested twice.
  const state = getState();
  if (state.phase !== "dashboard" || state.insightsLoading || state.insights[locale]) return;
  if (state.translating.includes(locale) || state.translationFailed.includes(locale)) return;
  const original = originalInsights(state);
  if (!original) return;
  const id = state.insightsId;
  dispatch({ type: "translating", locale });
  try {
    const insights =
      original.insights.source === "fallback"
        ? buildFallbackInsights(state.insightsAnalysis ?? state.analysis, locale)
        : await translateInsights(original.insights, locale);
    dispatch({ type: "translated", locale, insights, id });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    dispatch({ type: "translationFailed", locale, id });
  }
}

/**
 * Single client-side state machine: upload → processing → dashboard (or error).
 * Nothing is persisted — state lives in memory only (see ./store) and "Neu starten" drops it.
 * The state outlives a language switch; the insights follow the new language lazily.
 */
export function AnalyseApp() {
  const locale = useLocale();
  const state = useAnalyseState();

  useEffect(() => setActiveLocale(locale), [locale]);

  const run = useCallback(
    async (source: Source) => {
      const id = nextRunId();
      const alive = () => currentRunId() === id;
      const pace = prefersReducedMotion() ? 0 : 1;
      dispatch({ type: "start", source });
      try {
        const [parsed] = await Promise.all([
          source.kind === "sample" ? Promise.resolve<ParseResult>(getSampleStatement()) : parseStatement(source.file),
          wait(650 * pace),
        ]);
        if (!alive()) return;
        if (parsed.transactions.length === 0) throw Object.assign(new Error("no transactions"), { code: "no_transactions" });

        dispatch({ type: "stage", stage: "categorise" });
        const [categorised] = await Promise.all([
          categoriseTransactions(parsed.transactions, locale, (done, total) => {
            if (alive()) dispatch({ type: "progress", done, total });
          }),
          wait(800 * pace),
        ]);
        if (!alive()) return;

        dispatch({ type: "stage", stage: "analyse" });
        await wait(550 * pace);
        if (!alive()) return;
        const analysis = analyse(categorised);

        dispatch({
          type: "ready",
          meta: {
            format: parsed.format,
            bank: parsed.bank,
            currency: parsed.currency,
            fileName: source.kind === "file" ? source.file.name : undefined,
          },
          transactions: categorised,
          analysis,
        });
        window.scrollTo({ top: 0, behavior: pace ? "smooth" : "auto" });

        // Insights load only after the dashboard has painted.
        await wait(400 * pace + 50);
        if (!alive()) return;
        await loadInsights(analysis, 0, getActiveLocale(), id);
      } catch (error) {
        if (!alive()) return;
        if (process.env.NODE_ENV !== "production") console.error(error);
        dispatch({ type: "fail", code: errorCodeOf(error) });
      }
    },
    [locale],
  );

  const reset = useCallback(() => {
    nextRunId();
    dispatch({ type: "reset" });
    const url = new URL(window.location.href);
    if (url.searchParams.has("sample")) {
      url.searchParams.delete("sample");
      window.history.replaceState(null, "", url);
    }
    window.scrollTo({ top: 0 });
  }, []);

  // `?sample=1` auto-starts the demo. Read on the client so the page stays static.
  // A demo that is already running or done (e.g. after a language switch) is kept.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sample") !== "1" || isSample(getState())) return;
    const timer = setTimeout(() => void run({ kind: "sample" }), 0);
    return () => clearTimeout(timer);
  }, [run]);

  const onRecategorise = useCallback(
    (txId: string, category: CategoryId, applyToMerchant: boolean) => {
      if (state.phase !== "dashboard") return;
      const transactions = recategorise(state.transactions, txId, category, applyToMerchant);
      try {
        dispatch({ type: "recategorised", transactions, analysis: analyse(transactions) });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error(error);
      }
    },
    [state],
  );

  const onRefreshInsights = useCallback(() => {
    if (state.phase !== "dashboard") return;
    void loadInsights(state.analysis, state.version, locale, currentRunId());
  }, [state, locale]);

  // Lazy translation: only the language the user is looking at, and only once per set of insights.
  useEffect(() => {
    void ensureTranslated(locale);
  }, [state, locale]);

  const onRetryTranslation = useCallback(() => dispatch({ type: "retryTranslation", locale }), [locale]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-20 sm:px-6 sm:pt-10 lg:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.phase}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          >
            {state.phase === "upload" && <UploadStage onFile={(file) => run({ kind: "file", file })} onSample={() => run({ kind: "sample" })} />}
            {state.phase === "processing" && <ProcessingStage stage={state.stage} progress={state.progress} onCancel={reset} />}
            {state.phase === "error" && (
              <ErrorStage
                code={state.code}
                onRetry={() => run(state.source)}
                onOtherFile={reset}
                onSample={() => run({ kind: "sample" })}
              />
            )}
            {state.phase === "dashboard" && (
              <Dashboard
                state={state}
                onRestart={reset}
                onRecategorise={onRecategorise}
                onRefreshInsights={onRefreshInsights}
                onRetryTranslation={onRetryTranslation}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function isSample(state: ReturnType<typeof getState>) {
  if (state.phase === "dashboard") return state.meta.format === "sample";
  return state.phase !== "upload" && state.source.kind === "sample";
}
