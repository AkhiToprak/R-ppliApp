"use client";

import { motion } from "motion/react";
import { CATEGORIES } from "@/lib/categories";
import { formatDate, formatMoney } from "@/lib/i18n/core";
import { useLocale, useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import type { Analysis } from "@/lib/types";
import { EmptyState } from "./Charts";
import { merchantName } from "./model";
import { Card, CardTitle, CategoryBadge, CategoryChip, EASE_OUT } from "./ui";

const rowIn = (i: number) => ({
  initial: { opacity: 0, x: -12 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "0px 0px -40px 0px" },
  transition: { duration: 0.5, delay: i * 0.05, ease: EASE_OUT },
});

export function TopMerchants({ analysis, className }: { analysis: Analysis; className?: string }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const merchants = analysis.topMerchants.slice(0, 10);
  const max = merchants[0]?.total ?? 0;

  return (
    <Card labelledBy="merchants-title" className={className}>
      <CardTitle id="merchants-title">{t("merchantsTitle")}</CardTitle>
      {merchants.length === 0 ? (
        <EmptyState text={t("merchantsEmpty")} />
      ) : (
        <ol className="space-y-3.5">
          {merchants.map((m, i) => (
            <motion.li key={`${m.name}-${i}`} {...rowIn(i)} className="flex items-center gap-3">
              <CategoryBadge id={m.category} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-semibold" title={m.name}>{m.name}</span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {formatMoney(m.total, locale, { decimals: 0, currency: analysis.currency })}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-fog">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: CATEGORIES[m.category]?.color }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${max > 0 ? (m.total / max) * 100 : 0}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.15 + i * 0.05, ease: EASE_OUT }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs text-muted tabular-nums">{t("merchantsCount", { count: m.count })}</span>
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function RecurringList({ analysis, className }: { analysis: Analysis; className?: string }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const items = [...analysis.recurring].sort((a, b) => b.monthlyCost - a.monthlyCost);
  const totalMonthly = items.reduce((s, r) => s + r.monthlyCost, 0);
  const money = (n: number) => formatMoney(n, locale, { currency: analysis.currency });

  return (
    <Card labelledBy="recurring-title" className={className}>
      <CardTitle id="recurring-title">{t("recurringTitle")}</CardTitle>
      {items.length === 0 ? (
        <EmptyState text={t("recurringEmpty")} />
      ) : (
        <>
          <p className="mb-5 rounded-2xl bg-ink px-4 py-3 text-paper">
            <span className="font-display text-lg font-bold">{t("recurringTotal", { amount: money(totalMonthly) })}</span>
          </p>
          <ul className="divide-y divide-fog">
            {items.map((r, i) => (
              <motion.li key={`${r.name}-${i}`} {...rowIn(i)} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <CategoryBadge id={r.category} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={r.name}>{r.name}</p>
                  <span className="mt-1 inline-block rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-ink/70">
                    {t(`freq_${r.frequency}`)}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums">{t("perMonthShort", { amount: money(r.monthlyCost) })}</p>
                  {r.frequency !== "monthly" && (
                    <p className="text-xs text-muted tabular-nums">{money(r.amount)}</p>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function LargestExpenses({ analysis, className }: { analysis: Analysis; className?: string }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const items = analysis.largestExpenses;

  return (
    <Card labelledBy="largest-title" className={className}>
      <CardTitle id="largest-title">{t("largestTitle")}</CardTitle>
      {items.length === 0 ? (
        <EmptyState text={t("largestEmpty")} />
      ) : (
        <ul className="space-y-2.5">
          {items.map((tx, i) => (
            <motion.li key={tx.id} {...rowIn(i)} className="flex items-center gap-3 rounded-2xl bg-paper p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" title={tx.description}>{merchantName(tx)}</p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-xs text-muted tabular-nums">{formatDate(tx.date, locale)}</span>
                  {tx.category && <CategoryChip id={tx.category} className="py-0.5" />}
                </div>
              </div>
              <span className="shrink-0 text-base font-bold tabular-nums">
                {formatMoney(Math.abs(tx.amount), locale, { currency: tx.currency || analysis.currency })}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}
