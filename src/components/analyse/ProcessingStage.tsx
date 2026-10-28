"use client";

import { motion } from "motion/react";
import { Check, RotateCcw, Sparkles, Upload } from "lucide-react";
import clsx from "clsx";
import { RappliCoin } from "@/components/brand/RappliCoin";
import { useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import type { ErrorCode, Stage } from "./model";
import { Spinner } from "./Spinner";
import { EASE_OUT } from "./ui";

const STAGES: { id: Stage; key: "stageRead" | "stageCategorise" | "stageAnalyse" }[] = [
  { id: "read", key: "stageRead" },
  { id: "categorise", key: "stageCategorise" },
  { id: "analyse", key: "stageAnalyse" },
];

export function ProcessingStage({
  stage,
  progress,
  onCancel,
}: {
  stage: Stage;
  progress: { done: number; total: number } | null;
  onCancel: () => void;
}) {
  const t = useT(analyseMessages);
  const activeIndex = STAGES.findIndex((s) => s.id === stage);
  const ratio = progress && progress.total > 0 ? Math.min(1, progress.done / progress.total) : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center sm:py-16">
      <Spinner size={76} />
      <h1 className="mt-8 font-display text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
        {t("processingTitle")}
      </h1>

      <ol className="mt-10 w-full space-y-3 text-left" aria-live="polite">
        {STAGES.map((s, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
          return (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: EASE_OUT }}
              aria-current={state === "active" ? "step" : undefined}
              className={clsx(
                "relative overflow-hidden rounded-full px-5 py-4 transition-colors duration-500",
                state === "active" ? "bg-ink text-paper" : "bg-mist",
                state === "pending" && "text-muted",
              )}
            >
              {state === "active" && s.id === "categorise" && ratio !== null && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-paper/10"
                  initial={false}
                  animate={{ width: `${ratio * 100}%` }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                />
              )}
              <span className="relative flex items-center gap-4">
                <span
                  className={clsx(
                    "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                    state === "done" && "bg-mint text-ink",
                    state === "active" && "bg-coin text-ink",
                    state === "pending" && "bg-fog",
                  )}
                >
                  {state === "done" ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                      <Check size={16} strokeWidth={3} aria-hidden />
                    </motion.span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="flex-1 font-semibold">{t(s.key)}</span>
                {state === "active" && s.id === "categorise" && progress && progress.total > 0 && (
                  <span className="text-sm text-paper/70 tabular-nums">
                    {t("stageProgress", { done: progress.done, total: progress.total })}
                  </span>
                )}
                {state === "active" && !(s.id === "categorise" && progress) && (
                  <span aria-hidden className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="size-1.5 rounded-full bg-coin-light"
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }}
                      />
                    ))}
                  </span>
                )}
              </span>
            </motion.li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={onCancel}
        className="mt-8 rounded-full px-5 py-2.5 text-sm font-semibold text-muted hover:text-ink focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none"
      >
        {t("cancel")}
      </button>
    </div>
  );
}

export function ErrorStage({
  code,
  onRetry,
  onOtherFile,
  onSample,
}: {
  code: ErrorCode;
  onRetry: () => void;
  onOtherFile: () => void;
  onSample: () => void;
}) {
  const t = useT(analyseMessages);
  return (
    <div role="alert" className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center sm:py-16">
      <motion.span
        aria-hidden
        initial={{ rotate: 0, y: -20, opacity: 0 }}
        animate={{ rotate: [0, -18, 10, -6, 0], y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
        className="grayscale-[35%]"
      >
        <RappliCoin size={104} />
      </motion.span>
      <h1 className="mt-8 font-display text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">{t("errorTitle")}</h1>
      <p className="mt-5 max-w-lg text-lg text-ink/75">{t(`error_${code}`)}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-paper transition hover:bg-ink-soft focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none active:scale-[0.98]"
        >
          <RotateCcw size={18} aria-hidden />
          {t("retry")}
        </button>
        <button
          type="button"
          onClick={onOtherFile}
          className="inline-flex items-center gap-2 rounded-full bg-mist px-6 py-3 font-semibold text-ink transition hover:bg-fog focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none active:scale-[0.98]"
        >
          <Upload size={18} aria-hidden />
          {t("otherFile")}
        </button>
        <button
          type="button"
          onClick={onSample}
          className="inline-flex items-center gap-2 rounded-full bg-coin px-6 py-3 font-semibold text-ink transition hover:bg-coin-light focus-visible:ring-4 focus-visible:ring-ink/30 focus-visible:outline-none active:scale-[0.98]"
        >
          <Sparkles size={18} aria-hidden />
          {t("sampleButton")}
        </button>
      </div>
    </div>
  );
}
