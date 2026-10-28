"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import clsx from "clsx";
import { RappliCoin } from "@/components/brand/RappliCoin";
import { CATEGORIES } from "@/lib/categories";
import { formatDate, formatMoney, formatMonth, formatPercent } from "@/lib/i18n/core";
import { useLocale, useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import { NON_SPENDING_CATEGORIES, type Analysis, type CategoryId, type CategoryTotal } from "@/lib/types";
import { Card, CardTitle, CategoryBadge, CountUp, EASE_OUT, useCompactNumber } from "./ui";

/* Chart chrome tokens (light surface #f3f3f6). */
const GRID = "#e2e2e9";
const AXIS_TEXT = "#6b6b78";
const SURFACE = "#f3f3f6";
const FOLDED = "#a9a9b6";

/**
 * Income / spending / saved series. Validated with the dataviz palette checker:
 * lightness band, chroma floor and normal-vision separation pass; CVD separation
 * of teal↔pink is 7.8 (floor band) so the chart ships with a legend, 2px gaps and a table view.
 */
const SERIES_COLORS = { income: "#00a5a8", spending: "#ff3d8b", saved: "#b07d00" } as const;

/* ---------------------------------------------------------------- tooltip */

interface TipRow {
  color: string;
  label: string;
  value: string;
}

function TooltipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="min-w-[10rem] rounded-2xl bg-ink px-4 py-3 text-paper shadow-[0_12px_32px_-8px_rgba(11,11,15,0.5)]">
      <p className="mb-1.5 text-xs font-semibold text-paper/60">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="font-bold tabular-nums">{r.value}</span>
            <span className="text-paper/60">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TooltipLike = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };

/* ---------------------------------------------------------------- categories */

function spendingCategories(analysis: Analysis): CategoryTotal[] {
  return analysis.byCategory
    .filter((c) => !NON_SPENDING_CATEGORIES.includes(c.category) && c.total > 0)
    .sort((a, b) => b.total - a.total);
}

interface Slice {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
  category: CategoryId | null;
}

const MAX_SLICES = 6;

export function CategoryBreakdown({
  analysis,
  active,
  onSelect,
}: {
  analysis: Analysis;
  active: CategoryId | null;
  onSelect: (id: CategoryId) => void;
}) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const money = (n: number, decimals: 0 | 2 = 0) => formatMoney(n, locale, { decimals, currency: analysis.currency });

  const cats = useMemo(() => spendingCategories(analysis), [analysis]);
  const total = cats.reduce((s, c) => s + c.total, 0);
  const max = cats[0]?.total ?? 0;

  const slices = useMemo<Slice[]>(() => {
    const share = (v: number) => (total > 0 ? v / total : 0);
    const fold = cats.length > MAX_SLICES + 1;
    const head = fold ? cats.slice(0, MAX_SLICES) : cats;
    const out: Slice[] = head.map((c) => ({
      key: c.category,
      label: CATEGORIES[c.category].label[locale],
      value: c.total,
      share: share(c.total),
      color: CATEGORIES[c.category].color,
      category: c.category,
    }));
    if (fold) {
      const rest = cats.slice(MAX_SLICES).reduce((s, c) => s + c.total, 0);
      out.push({ key: "__rest", label: t("catOther"), value: rest, share: share(rest), color: FOLDED, category: null });
    }
    return out;
  }, [cats, total, locale, t]);

  const focused = hover !== null ? slices[hover] : null;
  const indexOf = (id: CategoryId) => {
    const i = slices.findIndex((s) => s.category === id);
    return i >= 0 ? i : slices.length - 1;
  };

  return (
    <Card labelledBy="cat-title">
      <CardTitle id="cat-title" aside={cats.length > 0 ? <p className="text-sm text-muted">{t("catFilterHint")}</p> : null}>
        {t("catTitle")}
      </CardTitle>

      {cats.length === 0 ? (
        <EmptyState text={t("catEmpty")} />
      ) : (
        <div className="grid items-center gap-8 lg:grid-cols-12">
          {/* Donut */}
          <div className="relative mx-auto aspect-square w-full max-w-[19rem] lg:col-span-5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke={SURFACE}
                  strokeWidth={2}
                  cornerRadius={4}
                  isAnimationActive={!reduce}
                  animationDuration={1100}
                  animationBegin={150}
                  rootTabIndex={-1}
                  onMouseEnter={(_, i) => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(_, i) => {
                    const id = slices[i]?.category;
                    if (id) onSelect(id);
                  }}
                >
                  {slices.map((s, i) => (
                    <Cell
                      key={s.key}
                      fill={s.color}
                      opacity={hover === null || hover === i ? 1 : 0.3}
                      style={{ cursor: s.category ? "pointer" : "default", transition: "opacity 200ms", outline: "none" }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Centre readout doubles as the donut's tooltip */}
            <div className="pointer-events-none absolute inset-[18%] flex flex-col items-center justify-center text-center" aria-live="polite">
              {focused ? (
                <>
                  <span className="line-clamp-2 text-sm font-semibold text-ink/70">{focused.label}</span>
                  <span className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{money(focused.value)}</span>
                  <span className="text-sm text-muted">{formatPercent(focused.share, locale, 1)}</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold text-ink/70">{t("catTotal")}</span>
                  <CountUp value={total} format={(n) => money(n)} className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl" />
                  <span className="text-sm text-muted">{t("catPerMonth", { amount: money(total / Math.max(1, analysis.months)) })}</span>
                </>
              )}
            </div>
          </div>

          {/* Legend list with bars */}
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:col-span-7" onMouseLeave={() => setHover(null)}>
            {cats.map((c, i) => {
              const meta = CATEGORIES[c.category];
              const selected = active === c.category;
              return (
                <li key={c.category}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.category)}
                    onMouseEnter={() => setHover(indexOf(c.category))}
                    onFocus={() => setHover(indexOf(c.category))}
                    onBlur={() => setHover(null)}
                    aria-pressed={selected}
                    className={clsx(
                      "group w-full rounded-2xl p-2.5 text-left transition-colors focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none",
                      selected ? "bg-paper ring-2 ring-ink" : "hover:bg-paper",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <CategoryBadge id={c.category} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{meta.label[locale]}</span>
                          <span className="shrink-0 text-sm font-bold tabular-nums">{money(c.total)}</span>
                        </span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-fog">
                          <motion.span
                            className="block h-full rounded-full"
                            style={{ background: meta.color }}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${max > 0 ? (c.total / max) * 100 : 0}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.9, delay: 0.1 + i * 0.04, ease: EASE_OUT }}
                          />
                        </span>
                        <span className="mt-1 flex justify-between gap-2 text-xs text-muted tabular-nums">
                          <span>{formatPercent(total > 0 ? c.total / total : 0, locale, 1)}</span>
                          <span>{t("catPerMonth", { amount: money(c.monthlyAverage) })}</span>
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- monthly trend */

type SeriesKey = keyof typeof SERIES_COLORS;
interface MonthRow {
  month: string;
  label: string;
  income: number;
  spending: number;
  saved: number;
}

export function MonthlyTrend({ analysis, className }: { analysis: Analysis; className?: string }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const compact = useCompactNumber();
  const [asTable, setAsTable] = useState(false);
  const money = (n: number) => formatMoney(n, locale, { decimals: 0, currency: analysis.currency });

  const data: MonthRow[] = analysis.byMonth.map((m) => ({
    month: m.month,
    label: formatMonth(m.month, locale),
    income: m.income,
    spending: m.spending,
    saved: m.saved,
  }));

  const series = (
    [
      { key: "income", label: t("kpiIncome"), show: analysis.totalIncome > 0 },
      { key: "spending", label: t("kpiSpending"), show: true },
      { key: "saved", label: t("kpiSaved"), show: analysis.totalSaved > 0 },
    ] as { key: SeriesKey; label: string; show: boolean }[]
  ).filter((s) => s.show);

  const renderTooltip = ({ active, payload }: TooltipLike) => {
    const row = payload?.[0]?.payload as MonthRow | undefined;
    if (!active || !row) return null;
    return (
      <TooltipBox
        title={formatMonth(row.month, locale, "long")}
        rows={series.map((s) => ({ color: SERIES_COLORS[s.key], label: s.label, value: money(row[s.key]) }))}
      />
    );
  };

  return (
    <Card labelledBy="trend-title" className={className}>
      <CardTitle
        id="trend-title"
        aside={
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3.5 py-2 text-sm font-semibold focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none"
          >
            {asTable ? <BarChart3 size={15} aria-hidden /> : <Table2 size={15} aria-hidden />}
            {asTable ? t("showChart") : t("showTable")}
          </button>
        }
      >
        {t("trendTitle")}
      </CardTitle>

      {/* Legend: always present for ≥2 series */}
      {series.length > 1 && !asTable && (
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-[3px]" style={{ background: SERIES_COLORS[s.key] }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {asTable ? (
        <div className="overflow-x-auto rounded-2xl bg-paper">
          <table className="w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="border-b border-fog text-left text-muted">
                <th scope="col" className="px-4 py-3 font-semibold">{t("colMonth")}</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="px-4 py-3 text-right font-semibold">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.month} className="border-b border-fog/70 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold">{formatMonth(row.month, locale, "long")}</th>
                  {series.map((s) => (
                    <td key={s.key} className="px-4 py-2.5 text-right tabular-nums">{money(row[s.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[18rem] w-full" role="img" aria-label={`${t("trendTitle")}: ${series.map((s) => s.label).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: GRID }}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                interval="preserveStartEnd"
                minTickGap={6}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v: number) => compact(v)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                width={44}
              />
              <Tooltip cursor={{ fill: "rgba(11,11,15,0.05)" }} content={renderTooltip} />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={SERIES_COLORS[s.key]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={!reduce}
                  animationDuration={900}
                  animationBegin={i * 120}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.length <= 1 && <p className="mt-4 text-sm text-muted">{t("trendSingleMonth")}</p>}
    </Card>
  );
}

/* ---------------------------------------------------------------- weekday */

const PEAK = "#0b0b0f";
const REST = "#c9c9d3";

export function WeekdayChart({ analysis, className }: { analysis: Analysis; className?: string }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const compact = useCompactNumber();

  const data = Array.from({ length: 7 }, (_, i) => {
    const iso = `2024-01-0${i + 1}`; // 1 Jan 2024 was a Monday
    return {
      day: formatDate(iso, locale, { weekday: "short" }),
      long: formatDate(iso, locale, { weekday: "long" }),
      value: analysis.weekdaySpending[i] ?? 0,
    };
  });
  const maxValue = Math.max(...data.map((d) => d.value));
  const peak = maxValue > 0 ? data.findIndex((d) => d.value === maxValue) : -1;

  const renderTooltip = ({ active, payload }: TooltipLike) => {
    const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
    if (!active || !row) return null;
    return (
      <TooltipBox
        title={row.long}
        rows={[{ color: PEAK, label: t("kpiSpending"), value: formatMoney(row.value, locale, { decimals: 0, currency: analysis.currency }) }]}
      />
    );
  };

  return (
    <Card labelledBy="weekday-title" className={className}>
      <CardTitle id="weekday-title">{t("weekdayTitle")}</CardTitle>
      <div className="h-[13rem] w-full" role="img" aria-label={t("weekdayTitle")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS_TEXT, fontSize: 12 }} tickMargin={8} interval={0} />
            <YAxis tickFormatter={(v: number) => compact(v)} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 12 }} width={40} />
            <Tooltip cursor={{ fill: "rgba(11,11,15,0.05)" }} content={renderTooltip} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduce} animationDuration={900}>
              {data.map((d, i) => (
                <Cell key={d.day} fill={i === peak ? PEAK : REST} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {peak >= 0 && (
        <p className="mt-4 text-sm font-semibold">
          {t("weekdayPeak", { day: data[peak].long })}
        </p>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- shared */

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center text-muted">
      <span className="opacity-60 grayscale">
        <RappliCoin size={44} />
      </span>
      <p className="text-sm">{text}</p>
    </div>
  );
}
