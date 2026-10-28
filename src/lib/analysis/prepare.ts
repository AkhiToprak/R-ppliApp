import type { CategoryId, Transaction } from "@/lib/types";
import { NON_SPENDING_CATEGORIES } from "@/lib/types";
import { dayNumber, parseISODate, weekdayIndex } from "./dates";

/** A transaction with derived, validated fields. */
export interface Entry {
  tx: Transaction;
  /** Effective category (see effectiveCategory). */
  cat: CategoryId;
  /** Days since epoch. */
  day: number;
  /** YYYY-MM */
  month: string;
  /** 0 = Monday */
  weekday: number;
}

export function isSpendingCategory(cat: CategoryId): boolean {
  return !NON_SPENDING_CATEGORIES.includes(cat);
}

/**
 * Missing category counts as "other". CHOICE: a positive ("money in") amount in
 * "other" / uncategorised is treated as income, because unclassified inflows are
 * overwhelmingly salary/payments received. Such rows therefore also show up in
 * the "income" CategoryTotal so totals stay consistent.
 */
export function effectiveCategory(tx: Transaction): CategoryId {
  const cat = tx.category ?? "other";
  return cat === "other" && tx.amount > 0 ? "income" : cat;
}

/** Drops rows with invalid dates / zero or non-finite amounts and derives helper fields. */
export function prepare(transactions: Transaction[]): Entry[] {
  const out: Entry[] = [];
  for (const tx of transactions) {
    if (!Number.isFinite(tx.amount) || tx.amount === 0) continue;
    const ymd = parseISODate(tx.date);
    if (!ymd) continue;
    const day = dayNumber(ymd);
    out.push({
      tx,
      cat: effectiveCategory(tx),
      day,
      month: tx.date.slice(0, 7),
      weekday: weekdayIndex(day),
    });
  }
  return out;
}

export function round2(x: number): number {
  const r = Math.round((x + Math.sign(x) * Number.EPSILON) * 100) / 100;
  return r === 0 ? 0 : r;
}

export function round4(x: number): number {
  const r = Math.round(x * 10000) / 10000;
  return r === 0 ? 0 : r;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Key with the highest count; the first-inserted key wins ties (deterministic). */
export function mostCommon<K>(counts: Map<K, number>): K | undefined {
  let best: K | undefined;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export function bump<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}
