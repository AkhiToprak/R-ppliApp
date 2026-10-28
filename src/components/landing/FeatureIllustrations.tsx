"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import type { CategoryId, Locale } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "@/components/analyse/ui";
import { formatMoney } from "@/lib/i18n/core";
import { RappliCoin } from "@/components/brand/RappliCoin";
import { CountUp } from "./CountUp";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Runs children's animations once the illustration is on screen. */
function useOnScreen<T extends Element = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  const reduce = useReducedMotion();
  return { ref, play: inView || !!reduce, reduce: !!reduce };
}

// ---- 1. Auto-categorisation ----------------------------------------------------

const RAW: [string, CategoryId][] = [
  ["MIGROS M ZUERICH HB", "groceries"],
  ["SBB CFF FFS MOBILE", "transport"],
  ["NETFLIX.COM AMSTERDAM", "subscriptions"],
  ["UBER *EATS HELP.UBER", "restaurants"],
];

export function CategoriseIllo({ locale }: { locale: Locale }) {
  const { ref, play, reduce } = useOnScreen();
  return (
    <div ref={ref} aria-hidden className="space-y-2.5">
      {RAW.map(([raw, cat], i) => {
        const meta = CATEGORIES[cat];
        return (
          <div key={raw} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <span className="min-w-0 truncate rounded-xl bg-paper/80 px-3 py-2 font-mono text-[0.72rem] text-ink/70 ring-1 ring-ink/5 sm:flex-1">
              {raw}
            </span>
            <motion.span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pr-3.5 pl-1.5 text-sm font-bold text-ink"
              style={{ background: `color-mix(in oklab, ${meta.color} 30%, white)` }}
              initial={reduce ? false : { opacity: 0, x: -24, scale: 0.8 }}
              animate={play ? { opacity: 1, x: 0, scale: 1 } : undefined}
              transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.25 + i * 0.22 }}
            >
              <span className="grid size-6 place-items-center rounded-full bg-paper">
                <CategoryIcon id={cat} size={13} />
              </span>
              {meta.label[locale]}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}

// ---- 2. Charts -----------------------------------------------------------------

const MONTHS = [
  [1850, 690, 820],
  [1850, 720, 1180],
  [1850, 640, 760],
  [1850, 810, 1420],
  [1850, 700, 960],
  [1850, 742, 2220],
];
const MAX = Math.max(...MONTHS.map((m) => m[0] + m[1] + m[2]));
const STACK: CategoryId[] = ["housing", "groceries", "restaurants"];

export function ChartsIllo({ locale }: { locale: Locale }) {
  const { ref, play, reduce } = useOnScreen();
  return (
    <div ref={ref} aria-hidden>
      <div className="flex h-40 items-end gap-2.5 sm:gap-3">
        {MONTHS.map((m, i) => {
          const total = m[0] + m[1] + m[2];
          return (
            <motion.div
              key={i}
              className="flex flex-1 origin-bottom flex-col-reverse overflow-hidden rounded-t-xl rounded-b-md"
              style={{ height: `${(total / MAX) * 100}%` }}
              initial={reduce ? false : { scaleY: 0 }}
              animate={play ? { scaleY: 1 } : undefined}
              transition={{ duration: 0.8, delay: 0.15 + i * 0.08, ease: EASE }}
            >
              {m.map((v, j) => (
                <div key={j} style={{ height: `${(v / total) * 100}%`, background: CATEGORIES[STACK[j]].color }} />
              ))}
            </motion.div>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-ink/70">
        {STACK.map((c) => (
          <li key={c} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: CATEGORIES[c].color }} />
            {CATEGORIES[c].label[locale]}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- 3. Score gauge ------------------------------------------------------------

export function ScoreIllo({ locale, persona }: { locale: Locale; persona: string }) {
  const { ref, play, reduce } = useOnScreen();
  return (
    <div ref={ref} aria-hidden className="mx-auto w-full max-w-[260px]">
      <div className="relative">
        <svg viewBox="0 0 200 112" className="w-full overflow-visible">
          <defs>
            <linearGradient id="score-grad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--color-pink)" />
              <stop offset="0.5" stopColor="var(--color-sun)" />
              <stop offset="1" stopColor="var(--color-mint)" />
            </linearGradient>
          </defs>
          <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="rgb(11 11 15 / 0.08)" strokeWidth="18" strokeLinecap="round" />
          <motion.path
            d="M 16 100 A 84 84 0 0 1 184 100"
            fill="none"
            stroke="url(#score-grad)"
            strokeWidth="18"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={play ? { pathLength: 0.72 } : undefined}
            transition={{ duration: 1.4, delay: 0.2, ease: EASE }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <CountUp value={72} locale={locale} delay={0.2} className="font-display text-6xl leading-none font-extrabold tracking-[-0.05em]" />
        </div>
      </div>
      <motion.p
        className="mx-auto mt-4 w-fit rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-paper"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={play ? { opacity: 1, y: 0 } : undefined}
        transition={{ delay: 1.3, duration: 0.4 }}
      >
        🦊 {persona}
      </motion.p>
    </div>
  );
}

// ---- 4. Strengths & weaknesses -------------------------------------------------

export function StrengthsIllo({ strengths, weaknesses }: { strengths: string[]; weaknesses: string[] }) {
  const { ref, play, reduce } = useOnScreen<HTMLUListElement>();
  const rows: { text: string; good: boolean }[] = [
    ...strengths.map((text) => ({ text, good: true })),
    ...weaknesses.map((text) => ({ text, good: false })),
  ];
  return (
    <ul ref={ref} aria-hidden className="space-y-2">
      {rows.map((r, i) => (
        <motion.li
          key={r.text}
          className="flex items-center gap-3 rounded-2xl bg-paper/80 px-3 py-2.5 text-sm font-semibold"
          initial={reduce ? false : { opacity: 0, x: r.good ? -20 : 20 }}
          animate={play ? { opacity: 1, x: 0 } : undefined}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: EASE }}
        >
          <span
            className={
              r.good
                ? "grid size-7 shrink-0 place-items-center rounded-full bg-mint text-ink"
                : "grid size-7 shrink-0 place-items-center rounded-full bg-pink text-paper"
            }
          >
            {r.good ? <Check className="size-4" strokeWidth={3} /> : <TriangleAlert className="size-3.5" strokeWidth={2.75} />}
          </span>
          {r.text}
        </motion.li>
      ))}
    </ul>
  );
}

// ---- 5. Critique speech bubble -------------------------------------------------

export function CritiqueIllo({ quote }: { quote: string }) {
  const { ref, play, reduce } = useOnScreen();
  return (
    <div ref={ref} className="relative pb-6 pl-14 sm:pl-20">
      <div aria-hidden className="absolute -top-4 right-0 h-28 w-40 text-pink/40 bg-halftone" />
      <motion.figure
        className="relative rounded-[1.75rem] border-[3px] border-ink bg-paper px-5 py-5 shadow-[6px_6px_0_var(--color-ink)] sm:px-7 sm:py-6"
        initial={reduce ? false : { opacity: 0, scale: 0.7, rotate: -4 }}
        animate={play ? { opacity: 1, scale: 1, rotate: -1.5 } : undefined}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }}
        style={{ transformOrigin: "10% 100%" }}
      >
        <blockquote className="font-display text-[1.6rem] leading-[1.05] font-extrabold tracking-tight sm:text-[2.1rem]">
          {quote}
        </blockquote>
        {/* bubble tail */}
        <svg aria-hidden viewBox="0 0 40 30" className="absolute -bottom-[27px] left-6 h-[30px] w-10">
          <path d="M2 0 L10 28 L30 0" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
          <rect x="0" y="-3" width="40" height="4" fill="var(--color-paper)" />
        </svg>
      </motion.figure>
      <div aria-hidden className="absolute bottom-0 left-0">
        <RappliCoin size={64} animated />
      </div>
    </div>
  );
}

// ---- 6. Saving options ---------------------------------------------------------

export function SavingsIllo({
  locale,
  items,
}: {
  locale: Locale;
  items: { text: string; amount: number; effort: string }[];
}) {
  const { ref, play, reduce } = useOnScreen<HTMLUListElement>();
  return (
    <ul ref={ref} aria-hidden className="space-y-2">
      {items.map((it, i) => (
        <motion.li
          key={it.text}
          className="flex items-center gap-3 rounded-2xl bg-paper/80 px-3 py-2.5"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={play ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 0.15 + i * 0.14, duration: 0.5, ease: EASE }}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{it.text}</span>
            <span className="text-xs text-ink/60">{it.effort}</span>
          </span>
          <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-coin-light tabular-nums">
            +{formatMoney(it.amount, locale, { decimals: 0 })}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

// ---- 7. Languages --------------------------------------------------------------

const HELLOS = [
  { lang: "de", word: "Grüezi" },
  { lang: "fr", word: "Bonjour" },
  { lang: "it", word: "Ciao" },
  { lang: "en", word: "Hello" },
];

export function LanguagesIllo({ locale }: { locale: Locale }) {
  const reduce = useReducedMotion();
  const start = Math.max(0, HELLOS.findIndex((h) => h.lang === locale));
  const [i, setI] = useState(start);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % HELLOS.length), 1900);
    return () => window.clearInterval(id);
  }, [reduce]);

  const current = HELLOS[i];
  return (
    <div aria-hidden>
      <div className="relative h-[4.5rem] overflow-hidden sm:h-20">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={current.word}
            lang={current.lang}
            className="absolute inset-x-0 font-display text-6xl leading-none font-extrabold tracking-[-0.05em] sm:text-7xl"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {current.word}
          </motion.span>
        </AnimatePresence>
      </div>
      <ul className="mt-5 flex gap-1.5">
        {HELLOS.map((h, n) => (
          <Pill key={h.lang} active={n === i}>
            {h.lang}
          </Pill>
        ))}
      </ul>
    </div>
  );
}

function Pill({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <li
      className={
        "rounded-full px-3 py-1 text-xs font-bold uppercase transition-colors duration-300 " +
        (active ? "bg-coin text-ink" : "bg-paper/10 text-paper/70")
      }
    >
      {children}
    </li>
  );
}
