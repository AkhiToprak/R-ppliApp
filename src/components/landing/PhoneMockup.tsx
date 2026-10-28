"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import type { CategoryId, Locale } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "@/components/analyse/ui";
import { formatMoney } from "@/lib/i18n/core";
import { CountUp } from "./CountUp";

export interface PhoneLabels {
  greeting: string;
  spent: string;
  score: string;
  persona: string;
  saving: string;
  perMonth: string;
}

// A believable Swiss month: CHF 4'812 total.
const SLICES: { cat: CategoryId; amount: number }[] = [
  { cat: "housing", amount: 1850 },
  { cat: "groceries", amount: 742 },
  { cat: "shopping", amount: 640 },
  { cat: "restaurants", amount: 586 },
  { cat: "leisure", amount: 420 },
  { cat: "transport", amount: 318 },
  { cat: "subscriptions", amount: 256 },
];
const TOTAL = SLICES.reduce((s, x) => s + x.amount, 0);
const ARCS = SLICES.map((s, i) => ({
  ...s,
  share: s.amount / TOTAL,
  start: SLICES.slice(0, i).reduce((sum, x) => sum + x.amount, 0) / TOTAL,
}));
const LEGEND: CategoryId[] = ["groceries", "restaurants", "transport"];
const SCORE = 72;

/** Stylised phone with a mini dashboard. Donut draws in, numbers count up. */
export function PhoneMockup({ locale, labels }: { locale: Locale; labels: PhoneLabels }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const play = inView || !!reduce;

  return (
    <div
      ref={ref}
      className="relative h-[540px] w-[264px] rounded-[3rem] bg-ink-soft p-2.5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] ring-1 ring-paper/15"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[2.4rem] bg-paper px-4 pt-3 pb-4 text-ink">
        {/* status bar */}
        <div className="flex h-6 items-center justify-between px-2 text-[0.65rem] font-bold">
          <span>9:41</span>
          <span className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
          <span className="flex items-center gap-1" aria-hidden>
            <span className="h-2 w-3 rounded-[2px] bg-ink" />
          </span>
        </div>

        <p className="mt-3 text-[0.72rem] font-semibold text-muted">{labels.greeting}</p>

        {/* donut */}
        <div className="relative mx-auto mt-2 size-[168px]">
          <svg viewBox="0 0 120 120" className="size-full" aria-hidden>
            <circle cx="60" cy="60" r="46" fill="none" stroke="var(--color-mist)" strokeWidth="16" />
            {ARCS.map((a, i) => (
              <g key={a.cat} transform={`rotate(${a.start * 360 - 90} 60 60)`}>
                <motion.circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke={CATEGORIES[a.cat].color}
                  strokeWidth="16"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: play ? Math.max(a.share - 0.012, 0.002) : 0 }}
                  transition={{ duration: 0.9, delay: 0.5 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                />
              </g>
            ))}
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <CountUp
              value={TOTAL}
              locale={locale}
              money
              delay={0.5}
              className="font-display text-[1.35rem] leading-none font-extrabold tracking-tight"
            />
            <span className="mt-1 text-[0.65rem] font-semibold text-muted">{labels.spent}</span>
          </div>
        </div>

        {/* legend */}
        <ul className="mt-3 space-y-2">
          {LEGEND.map((cat, i) => {
            const s = SLICES.find((x) => x.cat === cat)!;
            const meta = CATEGORIES[cat];
            return (
              <li key={cat} className="text-[0.7rem]">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full" style={{ background: `${meta.color}26` }}>
                    <CategoryIcon id={cat} size={11} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{meta.label[locale]}</span>
                  <span className="font-bold tabular-nums">{formatMoney(s.amount, locale, { decimals: 0 })}</span>
                </div>
                <div className="mt-1 ml-7 h-1 overflow-hidden rounded-full bg-mist">
                  <motion.div
                    className="h-full origin-left rounded-full"
                    style={{ background: meta.color, width: `${(s.amount / 742) * 100}%` }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: play ? 1 : 0 }}
                    transition={{ duration: 0.8, delay: 1.1 + i * 0.1, ease: "easeOut" }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {/* score */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-mist px-3 py-2.5">
          <div className="relative grid size-10 shrink-0 place-items-center">
            <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-fog)" strokeWidth="5" />
              <motion.circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="var(--color-mint)"
                strokeWidth="5"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: play ? SCORE / 100 : 0 }}
                transition={{ duration: 1.2, delay: 1.2, ease: "easeOut" }}
              />
            </svg>
            <CountUp value={SCORE} locale={locale} delay={1.2} className="relative text-[0.72rem] font-extrabold" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-[0.62rem] font-semibold text-muted">{labels.score}</p>
            <p className="truncate text-[0.8rem] font-bold">🦊 {labels.persona}</p>
          </div>
        </div>

        {/* saving potential */}
        <motion.div
          className="mt-auto rounded-2xl bg-coin px-3.5 py-3 text-ink"
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
          animate={play ? { opacity: 1, y: 0, scale: 1 } : undefined}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1.6 }}
        >
          <p className="text-[0.65rem] font-bold">{labels.saving}</p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <CountUp value={214} locale={locale} money delay={1.7} className="font-display text-2xl leading-none font-extrabold tracking-tight" />
            <span className="text-[0.65rem] font-semibold">{labels.perMonth}</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
