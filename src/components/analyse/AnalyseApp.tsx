"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { analyse } from "@/lib/analysis";
import { categoriseTransactions, recategorise } from "@/lib/categorise";
import { useLocale } from "@/lib/i18n/client";
import { fetchInsights } from "@/lib/llm/client";
import { getSampleStatement, parseStatement } from "@/lib/parsers";
import type { CategoryId, ParseResult } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { ErrorStage, ProcessingStage } from "./ProcessingStage";
import { UploadStage } from "./UploadStage";
import { errorCodeOf, initialState, reducer, type Source } from "./model";
import { EASE_OUT } from "./ui";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Single client-side state machine: upload → processing → dashboard (or error).
 * Nothing is persisted — state lives in memory only and "Neu starten" drops it.
 */
export function AnalyseApp() {
  const locale = useLocale();
  const [state, dispatch] = useReducer(reducer, initialState);
  // Each run gets an id; async continuations of an outdated run are ignored.
  const runId = useRef(0);

  const loadInsights = useCallback(
    async (analysis: Parameters<typeof fetchInsights>[0], version: number, id: number) => {
      dispatch({ type: "insightsLoading" });
      try {
        // Contract: never throws (falls back locally) — guarded anyway so the UI can't hang.
        const insights = await fetchInsights(analysis, locale);
        if (runId.current === id) dispatch({ type: "insights", insights, version });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error(error);
        if (runId.current === id) dispatch({ type: "insightsFailed" });
      }
    },
    [locale],
  );

  const run = useCallback(
    async (source: Source) => {
      const id = ++runId.current;
      const alive = () => runId.current === id;
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
        await loadInsights(analysis, 0, id);
      } catch (error) {
        if (!alive()) return;
        if (process.env.NODE_ENV !== "production") console.error(error);
        dispatch({ type: "fail", code: errorCodeOf(error) });
      }
    },
    [locale, loadInsights],
  );

  const reset = useCallback(() => {
    runId.current++;
    dispatch({ type: "reset" });
    const url = new URL(window.location.href);
    if (url.searchParams.has("sample")) {
      url.searchParams.delete("sample");
      window.history.replaceState(null, "", url);
    }
    window.scrollTo({ top: 0 });
  }, []);

  // `?sample=1` auto-starts the demo. Read on the client so the page stays static.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sample") !== "1") return;
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
    void loadInsights(state.analysis, state.version, runId.current);
  }, [state, loadInsights]);

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
              <Dashboard state={state} onRestart={reset} onRecategorise={onRecategorise} onRefreshInsights={onRefreshInsights} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
