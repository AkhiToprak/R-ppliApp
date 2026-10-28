"use client";

import { motion } from "motion/react";
import { Lightbulb, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import clsx from "clsx";
import { formatMoney } from "@/lib/i18n/core";
import { useLocale, useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import type { InsightItem, Insights, SavingOption } from "@/lib/types";
import { Spinner } from "./Spinner";
import { CategoryIcon, CountUp, EASE_OUT, Skeleton, staggerChild, staggerParent } from "./ui";

export function InsightsSection({
  insights,
  loading,
  stale,
  onRefresh,
}: {
  insights: Insights | null;
  loading: boolean;
  stale: boolean;
  onRefresh: () => void;
}) {
  const t = useT(analyseMessages);

  if (!insights && !loading) return null;
  if (!insights) {
    return (
      <section aria-busy="true" aria-label={t("thinking")} className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3 rounded-[2rem] bg-mist px-5 py-4">
          <Spinner size={26} />
          <span className="font-display text-xl font-bold">{t("thinking")}</span>
        </div>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-[2rem] bg-mist p-6">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-[2rem]" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className={clsx("space-y-4 transition-opacity duration-300 sm:space-y-6", loading && "pointer-events-none opacity-50")} aria-busy={loading}>
      {stale && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-[2rem] bg-sun/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="text-sm font-semibold">{t("insightsStale")}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none sm:self-auto"
          >
            <RefreshCw size={15} aria-hidden />
            {t("refreshInsights")}
          </button>
        </motion.div>
      )}

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <ItemColumn id="strengths-title" title={t("strengthsTitle")} items={insights.strengths} tone="good" empty={t("insightsEmpty")} />
        <ItemColumn id="weaknesses-title" title={t("weaknessesTitle")} items={insights.weaknesses} tone="bad" empty={t("insightsEmpty")} />
      </div>

      {insights.critiques.length > 0 && <Critiques insights={insights} />}
      {insights.savings.length > 0 && <Savings options={insights.savings} />}
    </div>
  );
}

/* ---------------------------------------------------------------- strengths & weaknesses */

function ItemColumn({
  id,
  title,
  items,
  tone,
  empty,
}: {
  id: string;
  title: string;
  items: InsightItem[];
  tone: "good" | "bad";
  empty: string;
}) {
  const Icon = tone === "good" ? ThumbsUp : ThumbsDown;
  return (
    <section aria-labelledby={id} className={clsx("rounded-[2rem] p-5 sm:p-7", tone === "good" ? "bg-mint/15" : "bg-pink/10")}>
      <h2 id={id} className="mb-4 flex items-center gap-3 font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
        <span className={clsx("grid size-10 place-items-center rounded-full text-ink", tone === "good" ? "bg-mint" : "bg-pink")}>
          <Icon size={18} aria-hidden strokeWidth={2.4} />
        </span>
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <motion.ul variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-3">
          {items.map((item, i) => (
            <motion.li key={`${item.title}-${i}`} variants={staggerChild} className="rounded-3xl bg-paper/80 p-4 sm:p-5">
              <h3 className="font-bold">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">{item.detail}</p>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- critiques */

function Critiques({ insights }: { insights: Insights }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  return (
    <section aria-labelledby="critique-title">
      <h2 id="critique-title" className="mb-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t("critiqueTitle")}
      </h2>
      <motion.ul
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px -60px 0px" }}
        className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3"
      >
        {insights.critiques.map((c, i) => (
          <motion.li
            key={`${c.title}-${i}`}
            variants={staggerChild}
            whileHover={{ rotate: i % 2 ? 0.6 : -0.6, y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex flex-col rounded-[2rem] border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-xs font-semibold">
                {c.category && <CategoryIcon id={c.category} size={13} />}
                <span className="truncate">{c.target}</span>
              </span>
              {typeof c.amount === "number" && c.amount > 0 && (
                <span className="rounded-full bg-coin px-3 py-1 text-xs font-bold tabular-nums">
                  {t("critiquePerMonth", { amount: formatMoney(c.amount, locale, { decimals: 0 }) })}
                </span>
              )}
            </div>
            <h3 className="mt-4 font-display text-2xl leading-[1.1] font-extrabold tracking-tight text-balance">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/75">{c.detail}</p>
            <div className="mt-auto pt-4">
              <p className="flex gap-2.5 rounded-2xl bg-sun/25 p-3.5 text-sm leading-relaxed">
                <Lightbulb size={17} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-bold">{t("critiqueSuggestion")}: </span>
                  {c.suggestion}
                </span>
              </p>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

/* ---------------------------------------------------------------- savings */

const EFFORT_STYLE: Record<SavingOption["effort"], string> = {
  easy: "bg-mint/25",
  medium: "bg-sun/35",
  hard: "bg-orange/25",
};

function Savings({ options }: { options: SavingOption[] }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const sorted = [...options].sort((a, b) => b.monthlySaving - a.monthlySaving);
  const monthly = sorted.reduce((s, o) => s + Math.max(0, o.monthlySaving), 0);
  const money = (n: number) => formatMoney(n, locale, { decimals: 0 });

  return (
    <section aria-labelledby="savings-title" className="grid gap-4 sm:gap-6 lg:grid-cols-12">
      <div className="rounded-[2rem] bg-mist p-5 sm:p-7 lg:col-span-7">
        <h2 id="savings-title" className="mb-5 font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
          {t("savingsTitle")}
        </h2>
        <motion.ul variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-3">
          {sorted.map((o, i) => (
            <motion.li key={`${o.title}-${i}`} variants={staggerChild} className="rounded-3xl bg-paper p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <h3 className="min-w-0 flex-1 font-bold">{o.title}</h3>
                <span className="shrink-0 font-bold tabular-nums">{t("savingsPerMonth", { amount: money(o.monthlySaving) })}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">{o.detail}</p>
              <span className={clsx("mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold", EFFORT_STYLE[o.effort])}>
                {t(`effort_${o.effort}`)}
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="relative isolate flex flex-col justify-center overflow-hidden rounded-[2rem] bg-ink p-7 text-paper sm:p-10 lg:col-span-5 lg:self-start lg:sticky lg:top-24"
      >
        <div aria-hidden className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-rainbow opacity-30 blur-3xl" />
        <p className="text-sm font-semibold text-paper/70">{t("savingsPotential")}</p>
        <p className="mt-2 font-display text-[2.5rem] leading-none font-extrabold tracking-tight text-rainbow sm:text-6xl lg:text-[2.75rem] xl:text-[3.25rem]">
          <CountUp value={monthly} format={(n) => t("savingsPerMonth", { amount: money(n) }).replace("/", "/\u200B")} duration={1.4} />
        </p>
        <p className="mt-5 border-t border-paper/15 pt-5 text-2xl font-bold tracking-tight sm:text-3xl">
          <CountUp value={monthly * 12} format={(n) => t("savingsPerYear", { amount: money(n) })} duration={1.6} />
        </p>
      </motion.div>
    </section>
  );
}
