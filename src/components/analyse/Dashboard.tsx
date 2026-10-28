"use client";

import { useCallback, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarRange, FileText, Info, ReceiptText, RefreshCw, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/i18n/core";
import { useLocale, useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import type { CategoryId } from "@/lib/types";
import { CategoryBreakdown, MonthlyTrend, WeekdayChart } from "./Charts";
import { InsightsSection } from "./Insights";
import { KpiTiles } from "./KpiTiles";
import { LargestExpenses, RecurringList, TopMerchants } from "./Lists";
import type { DashboardState } from "./model";
import { ScoreCard } from "./ScoreCard";
import { TransactionsTable } from "./TransactionsTable";
import { EASE_OUT } from "./ui";

export function Dashboard({
  state,
  onRestart,
  onRecategorise,
  onRefreshInsights,
}: {
  state: DashboardState;
  onRestart: () => void;
  onRecategorise: (txId: string, category: CategoryId, applyToMerchant: boolean) => void;
  onRefreshInsights: () => void;
}) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const { analysis, meta, insights, insightsLoading } = state;
  const stale = !!insights && !insightsLoading && state.insightsVersion !== state.version;
  const [filter, setFilter] = useState<CategoryId | null>(null);

  const showCategory = useCallback((id: CategoryId) => {
    setFilter(id);
    requestAnimationFrame(() =>
      document.getElementById("transactions")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  const source = meta.format === "sample" ? t("format_sample") : [meta.bank, t(`format_${meta.format}`)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header strip */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="flex flex-col gap-5 pb-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <h1 className="font-display text-[2.6rem] leading-[0.95] font-extrabold tracking-tight sm:text-6xl">{t("dashTitle")}</h1>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            <MetaPill icon={<CalendarRange size={15} aria-hidden />} label={t("periodLabel")}>
              {formatDate(analysis.period.from, locale)} – {formatDate(analysis.period.to, locale)}
            </MetaPill>
            <MetaPill icon={<FileText size={15} aria-hidden />} label={t("sourceLabel")}>
              {source}
            </MetaPill>
            <MetaPill icon={<ReceiptText size={15} aria-hidden />}>
              {t("txCount", { count: analysis.transactionCount })}
            </MetaPill>
          </ul>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-ink px-6 py-3 font-semibold text-paper transition hover:bg-ink-soft focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none active:scale-[0.98] sm:self-auto"
        >
          <RotateCcw size={18} aria-hidden />
          {t("restart")}
        </button>
      </motion.header>

      {/* Score + KPIs */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        <ScoreCard className="lg:col-span-5" insights={insights} loading={insightsLoading && !insights} />
        <KpiTiles className="lg:col-span-7" analysis={analysis} />
      </div>

      <CategoryBreakdown analysis={analysis} active={filter} onSelect={showCategory} />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        <MonthlyTrend className="lg:col-span-8" analysis={analysis} />
        <WeekdayChart className="lg:col-span-4" analysis={analysis} />
      </div>

      <InsightsSection
        insights={insights}
        loading={insightsLoading}
        stale={stale}
        onRefresh={onRefreshInsights}
      />

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        <TopMerchants analysis={analysis} />
        <RecurringList analysis={analysis} />
        <LargestExpenses analysis={analysis} className="md:col-span-2 xl:col-span-1" />
      </div>

      <TransactionsTable
        transactions={state.transactions}
        filter={filter}
        onFilterChange={setFilter}
        onRecategorise={onRecategorise}
      />

      <p className="flex gap-3 rounded-[2rem] border border-fog px-6 py-5 text-sm leading-relaxed text-muted">
        <Info size={18} aria-hidden className="mt-0.5 shrink-0" />
        {t("disclaimer")}
      </p>

      {/* Floating refresh pill once categories changed */}
      <AnimatePresence>
        {stale && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6"
          >
            <button
              type="button"
              onClick={onRefreshInsights}
              className="inline-flex items-center gap-2 rounded-full bg-ink py-3 pr-6 pl-3 font-semibold text-paper shadow-[0_12px_40px_-8px_rgba(11,11,15,0.45)] focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none active:scale-[0.98]"
            >
              <span className="grid size-8 place-items-center rounded-full bg-rainbow text-ink">
                <RefreshCw size={16} aria-hidden />
              </span>
              {t("refreshInsights")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetaPill({ icon, label, children }: { icon: ReactNode; label?: string; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-2 rounded-full bg-mist px-3.5 py-2">
      <span className="text-muted">{icon}</span>
      {label ? <span className="sr-only">{label}: </span> : null}
      <span className="font-semibold">{children}</span>
    </li>
  );
}
