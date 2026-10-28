"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";
import clsx from "clsx";
import { RappliCoin } from "@/components/brand/RappliCoin";
import { useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import type { Insights } from "@/lib/types";
import { Spinner } from "./Spinner";
import { CountUp, EASE_OUT, Skeleton } from "./ui";

// 270° arc, open at the bottom: from 135° (bottom-left) clockwise to 45° (bottom-right).
const ARC = "M 43.43 156.57 A 80 80 0 1 1 156.57 156.57";
const CELEBRATE_FROM = 75;

export function ScoreCard({
  insights,
  loading,
  className,
}: {
  insights: Insights | null;
  loading: boolean;
  className?: string;
}) {
  const t = useT(analyseMessages);
  const gradientId = useId();
  const score = insights ? Math.round(Math.max(0, Math.min(100, insights.score))) : 0;

  return (
    <section
      aria-labelledby="score-title"
      aria-busy={loading}
      className={clsx("relative isolate overflow-hidden rounded-[2rem] bg-ink p-6 text-paper sm:p-8", className)}
    >
      <div aria-hidden className="absolute -bottom-28 -left-20 -z-10 size-72 rounded-full bg-rainbow opacity-25 blur-3xl" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="score-title" className="text-sm font-semibold text-paper/70">
          {t("scoreTitle")}
        </h2>
        {insights?.source === "fallback" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 text-xs font-semibold text-paper/85">
            <Sparkles size={12} aria-hidden className="opacity-60" />
            {t("fallbackBadge")}
          </span>
        )}
      </div>

      <div className="relative mx-auto mt-2 aspect-square w-full max-w-[17rem]">
        <svg viewBox="0 0 200 200" className="size-full" role="img" aria-label={insights ? t("scoreAria", { score }) : t("thinking")}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-pink)" />
              <stop offset="35%" stopColor="var(--color-orange)" />
              <stop offset="65%" stopColor="var(--color-sun)" />
              <stop offset="100%" stopColor="var(--color-mint)" />
            </linearGradient>
          </defs>
          <path d={ARC} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" strokeLinecap="round" />
          {insights && (
            <motion.path
              d={ARC}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="14"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: Math.max(0.001, score / 100), opacity: 1 }}
              transition={{ pathLength: { duration: 1.6, ease: EASE_OUT, delay: 0.15 }, opacity: { duration: 0.2 } }}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pb-4">
          {insights ? (
            <>
              <CountUp
                value={score}
                duration={1.6}
                format={(n) => String(Math.round(n))}
                className="font-display text-7xl leading-none font-extrabold tracking-tight sm:text-8xl"
              />
              <span className="mt-1 text-sm text-paper/60">{t("scoreOutOf")}</span>
            </>
          ) : !loading ? (
            <span className="font-display text-7xl leading-none font-extrabold text-paper/40">–</span>
          ) : (
            <>
              <Spinner size={48} />
              <span className="mt-3 text-sm font-semibold text-paper/70">{t("thinking")}</span>
            </>
          )}
        </div>

        {insights && score >= CELEBRATE_FROM && <CoinBurst key={score} />}
      </div>

      <div className="mt-2 min-h-[6.5rem] text-center" aria-live="polite">
        {insights ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6, ease: EASE_OUT }}>
            <p className="font-display text-3xl leading-tight font-extrabold text-rainbow sm:text-4xl">{insights.persona}</p>
            <p className="mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-paper/75">{insights.summary}</p>
          </motion.div>
        ) : loading ? (
          <div className="mx-auto max-w-sm space-y-2.5">
            <Skeleton className="mx-auto h-8 w-40 bg-paper/10" />
            <Skeleton className="h-3.5 w-full bg-paper/10" />
            <Skeleton className="mx-auto h-3.5 w-3/4 bg-paper/10" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- celebration */

const CONFETTI_COLORS = ["#ff3d8b", "#ff7a1a", "#ffc800", "#19d3a2", "#1fb6ff", "#7b5cff"];

/** Deterministic pseudo-random in [0,1) so renders stay pure. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

function CoinBurst() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const angle = (i / 26) * Math.PI * 2 + rand(i) * 0.5;
        const dist = 95 + rand(i + 100) * 85;
        return {
          i,
          coin: i % 4 === 0,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rotate: (rand(i + 200) - 0.5) * 720,
          delay: 0.9 + rand(i + 300) * 0.25,
          w: 6 + rand(i + 400) * 6,
        };
      }),
    [],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 60], scale: [0, 1, 0.9], opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 1.8, delay: p.delay, ease: [0.2, 0.8, 0.4, 1], times: [0, 0.45, 1] }}
        >
          {p.coin ? (
            <RappliCoin size={22} />
          ) : (
            <span className="block rounded-[2px]" style={{ width: p.w, height: p.w * 0.45, background: p.color }} />
          )}
        </motion.span>
      ))}
    </div>
  );
}
