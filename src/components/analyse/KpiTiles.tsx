"use client";

import type { ComponentType } from "react";
import { motion } from "motion/react";
import { CalendarDays, Percent, PiggyBank, Scale, ShoppingCart, Wallet, type LucideProps } from "lucide-react";
import clsx from "clsx";
import { formatMoney, formatPercent } from "@/lib/i18n/core";
import { useLocale, useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import type { Analysis } from "@/lib/types";
import { CountUp, EASE_OUT, staggerChild, staggerParent } from "./ui";

interface Tile {
  key: string;
  label: string;
  icon: ComponentType<LucideProps>;
  accent: string;
  value: number | null;
  format: (n: number) => string;
  hint: string;
  meter?: number;
}

export function KpiTiles({ analysis, className }: { analysis: Analysis; className?: string }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const money = (n: number, sign = false) => formatMoney(n, locale, { decimals: 0, currency: analysis.currency, sign });
  const perMonth = (n: number) => t("kpiPerMonth", { amount: money(n / Math.max(1, analysis.months)) });
  const rate = analysis.savingsRate;

  const tiles: Tile[] = [
    {
      key: "income",
      label: t("kpiIncome"),
      icon: Wallet,
      accent: "var(--color-mint)",
      value: analysis.totalIncome,
      format: (n) => money(n),
      hint: analysis.totalIncome > 0 ? perMonth(analysis.totalIncome) : t("kpiNoIncome"),
    },
    {
      key: "spending",
      label: t("kpiSpending"),
      icon: ShoppingCart,
      accent: "var(--color-pink)",
      value: analysis.totalSpending,
      format: (n) => money(n),
      hint: perMonth(analysis.totalSpending),
    },
    {
      key: "saved",
      label: t("kpiSaved"),
      icon: PiggyBank,
      accent: "var(--color-coin)",
      value: analysis.totalSaved,
      format: (n) => money(n),
      hint: perMonth(analysis.totalSaved),
    },
    {
      key: "net",
      label: t("kpiNet"),
      icon: Scale,
      accent: analysis.net >= 0 ? "var(--color-sky)" : "var(--color-orange)",
      value: analysis.net,
      format: (n) => money(n, true),
      hint: t("kpiNetHint"),
    },
    {
      key: "rate",
      label: t("kpiSavingsRate"),
      icon: Percent,
      accent: "var(--color-violet)",
      value: rate,
      format: (n) => formatPercent(n, locale),
      hint: rate === null ? t("kpiNoIncome") : t("kpiSavingsRateHint"),
      meter: rate === null ? undefined : Math.max(0, Math.min(1, rate)),
    },
    {
      key: "daily",
      label: t("kpiDaily"),
      icon: CalendarDays,
      accent: "var(--color-orange)",
      value: analysis.dailyAverageSpending,
      format: (n) => formatMoney(n, locale, { decimals: 2, currency: analysis.currency }),
      hint: t("kpiDailyHint"),
    },
  ];

  return (
    <motion.ul
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4", className)}
    >
      {tiles.map((tile) => (
        <motion.li
          key={tile.key}
          variants={staggerChild}
          className="relative flex min-w-0 flex-col rounded-[2rem] bg-mist p-4 sm:p-5"
        >
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: tile.accent }}>
              <tile.icon size={16} aria-hidden className="text-ink" strokeWidth={2.4} />
            </span>
            <span className="truncate text-sm font-semibold text-ink/70">{tile.label}</span>
          </div>
          <p className="mt-3 text-lg leading-tight font-bold tracking-tight whitespace-nowrap sm:text-2xl xl:text-[1.75rem]">
            {tile.value === null ? "–" : <CountUp value={tile.value} format={tile.format} />}
          </p>
          {tile.meter !== undefined && (
            <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet/20">
              <motion.div
                className="h-full rounded-full bg-violet"
                initial={{ width: 0 }}
                animate={{ width: `${tile.meter * 100}%` }}
                transition={{ duration: 1.1, delay: 0.3, ease: EASE_OUT }}
              />
            </div>
          )}
          <p className="mt-auto pt-2 text-xs leading-snug text-muted sm:text-[0.8rem]">{tile.hint}</p>
        </motion.li>
      ))}
    </motion.ul>
  );
}
