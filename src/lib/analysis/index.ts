import type {
  Analysis,
  CategoryId,
  CategoryTotal,
  MonthlySummary,
  Transaction,
} from "@/lib/types";
import { CATEGORY_IDS } from "@/lib/types";
import { monthRange } from "./dates";
import { topMerchants } from "./merchants";
import {
  bump,
  isSpendingCategory,
  mostCommon,
  prepare,
  round2,
  round4,
  type Entry,
} from "./prepare";
import { detectRecurring } from "./recurring";

export { summariseForLLM } from "./summarise";

const DAYS_PER_MONTH = 30.44;

function emptyAnalysis(currency: string): Analysis {
  return {
    currency,
    period: { from: "", to: "" },
    months: 1,
    totalIncome: 0,
    totalSpending: 0,
    totalSaved: 0,
    net: 0,
    savingsRate: null,
    dailyAverageSpending: 0,
    byCategory: [],
    byMonth: [],
    topMerchants: [],
    recurring: [],
    largestExpenses: [],
    weekdaySpending: [0, 0, 0, 0, 0, 0, 0],
    transactionCount: 0,
  };
}

/**
 * Signed contribution of an entry to its category's accumulator (positive =
 * adds to the category total), or null when the row is ignored.
 *  - income:           inflows add, outflows (reversals) subtract
 *  - savings/transfers: only outflows count (money moved away)
 *  - spending:         outflows add, refunds subtract
 */
function contribution(e: Entry): number | null {
  const a = e.tx.amount;
  if (e.cat === "income") return a;
  if (e.cat === "savings" || e.cat === "transfers") return a < 0 ? -a : null;
  return -a;
}

interface MonthAcc {
  income: number;
  saved: number;
  cats: Map<CategoryId, number>;
}

const floor0 = (x: number) => (x > 0 ? x : 0);

/**
 * Pure budget analysis. Notes:
 *  - Rows with invalid dates or zero amounts are skipped (transactionCount counts the rest).
 *  - Amounts are not currency-converted; `currency` is the most common one.
 *  - Spending/income floors (refunds can't push below 0) are applied per category
 *    and per month, so totalSpending equals the sum of category totals and may
 *    differ marginally from the sum of monthly spending when a refund lands in a
 *    later month than its purchase.
 */
export function analyse(transactions: Transaction[]): Analysis {
  const entries = prepare(transactions);

  const currencies = new Map<string, number>();
  for (const e of entries) bump(currencies, e.tx.currency);
  const currency =
    [...currencies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    mostCommon(new Map(transactions.map((t) => [t.currency, 1] as const))) ??
    "CHF";

  if (entries.length === 0) return emptyAnalysis(currency);

  // ---- period ----
  let first = entries[0];
  let last = entries[0];
  for (const e of entries) {
    if (e.day < first.day) first = e;
    if (e.day > last.day) last = e;
  }
  const days = Math.max(1, last.day - first.day + 1);
  const months = Math.max(1, days / DAYS_PER_MONTH);

  // ---- accumulate ----
  const catAcc = new Map<CategoryId, { net: number; count: number }>();
  const monthAcc = new Map<string, MonthAcc>();
  const weekday = [0, 0, 0, 0, 0, 0, 0];

  for (const e of entries) {
    const c = contribution(e);
    if (c === null) continue;

    const acc = catAcc.get(e.cat) ?? { net: 0, count: 0 };
    acc.net += c;
    acc.count += 1;
    catAcc.set(e.cat, acc);

    const m = monthAcc.get(e.month) ?? { income: 0, saved: 0, cats: new Map() };
    if (e.cat === "income") m.income += c;
    else if (e.cat === "savings") m.saved += c;
    else if (isSpendingCategory(e.cat)) {
      bump(m.cats, e.cat, c);
      weekday[e.weekday] += c;
    }
    monthAcc.set(e.month, m);
  }

  // ---- totals ----
  const rawTotals = new Map<CategoryId, number>();
  let totalSpending = 0;
  for (const [cat, acc] of catAcc) {
    const total = floor0(acc.net);
    rawTotals.set(cat, total);
    if (isSpendingCategory(cat)) totalSpending += total;
  }
  const totalIncome = rawTotals.get("income") ?? 0;
  const totalSaved = rawTotals.get("savings") ?? 0;

  const byCategory: CategoryTotal[] = [];
  for (const [cat, total] of rawTotals) {
    const rounded = round2(total);
    if (rounded <= 0) continue;
    byCategory.push({
      category: cat,
      total: rounded,
      count: catAcc.get(cat)?.count ?? 0,
      share: isSpendingCategory(cat) && totalSpending > 0 ? round4(total / totalSpending) : 0,
      monthlyAverage: round2(total / months),
    });
  }
  byCategory.sort(
    (a, b) =>
      b.total - a.total || CATEGORY_IDS.indexOf(a.category) - CATEGORY_IDS.indexOf(b.category),
  );

  // ---- months (gap-filled) ----
  const byMonth: MonthlySummary[] = monthRange(
    first.tx.date.slice(0, 7),
    last.tx.date.slice(0, 7),
  ).map((month) => {
    const acc = monthAcc.get(month);
    const cats: Partial<Record<CategoryId, number>> = {};
    let spending = 0;
    if (acc) {
      for (const [cat, v] of acc.cats) {
        const f = floor0(v);
        spending += f;
        if (round2(f) > 0) cats[cat] = round2(f);
      }
    }
    return {
      month,
      income: round2(floor0(acc?.income ?? 0)),
      spending: round2(spending),
      saved: round2(floor0(acc?.saved ?? 0)),
      byCategory: cats,
    };
  });

  // ---- merchants, recurring, largest ----
  const spendingEntries = entries.filter((e) => isSpendingCategory(e.cat));
  const largestExpenses = spendingEntries
    .filter((e) => e.tx.amount < 0)
    .sort(
      (a, b) =>
        a.tx.amount - b.tx.amount ||
        (a.tx.date < b.tx.date ? -1 : a.tx.date > b.tx.date ? 1 : 0) ||
        (a.tx.id < b.tx.id ? -1 : a.tx.id > b.tx.id ? 1 : 0),
    )
    .slice(0, 5)
    .map((e) => ({ ...e.tx }));

  const net = totalIncome - totalSpending - totalSaved;
  const savingsRate =
    totalIncome > 0
      ? round4(Math.max(-1, Math.min(1, (totalIncome - totalSpending) / totalIncome)))
      : null;

  return {
    currency,
    period: { from: first.tx.date, to: last.tx.date },
    months: round2(months),
    totalIncome: round2(totalIncome),
    totalSpending: round2(totalSpending),
    totalSaved: round2(totalSaved),
    net: round2(net),
    savingsRate,
    dailyAverageSpending: round2(totalSpending / days),
    byCategory,
    byMonth,
    topMerchants: topMerchants(spendingEntries, 10),
    recurring: detectRecurring(entries),
    largestExpenses,
    weekdaySpending: weekday.map((v) => round2(floor0(v))),
    transactionCount: entries.length,
  };
}
