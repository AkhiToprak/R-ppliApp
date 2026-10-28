import type { CategoryId, RecurringPayment } from "@/lib/types";
import { MerchantNaming, merchantKey } from "./merchants";
import { median, round2, type Entry } from "./prepare";

type Frequency = RecurringPayment["frequency"];

const AMOUNT_TOLERANCE = 0.15;
/** Share of intervals that must fall inside the frequency window. */
const MIN_INTERVAL_CONSISTENCY = 0.7;

const WINDOWS: { frequency: Frequency; min: number; max: number; minOccurrences: number }[] = [
  { frequency: "weekly", min: 6, max: 8, minOccurrences: 3 },
  { frequency: "monthly", min: 26, max: 35, minOccurrences: 2 },
  { frequency: "quarterly", min: 85, max: 95, minOccurrences: 2 },
  { frequency: "yearly", min: 350, max: 380, minOccurrences: 2 },
];

const MONTHLY_FACTOR: Record<Frequency, number> = {
  weekly: 4.33,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

/**
 * Habitual day-to-day spending is not a commitment even when amounts happen to
 * be similar, so these categories never count as recurring payments.
 * Income and transfers are excluded because they are not payments.
 */
const NOT_RECURRING: readonly CategoryId[] = [
  "income",
  "transfers",
  "groceries",
  "restaurants",
  "cash",
];

interface Occurrence {
  entry: Entry;
  amount: number; // positive
}

function windowFor(interval: number) {
  return WINDOWS.find((w) => interval >= w.min && interval <= w.max);
}

/** Splits amounts (sorted ascending) into clusters of roughly similar size. */
function clusterByAmount(occs: Occurrence[]): Occurrence[][] {
  const sorted = [...occs].sort((a, b) => a.amount - b.amount || a.entry.day - b.entry.day);
  const clusters: Occurrence[][] = [];
  let start = 0;
  for (const o of sorted) {
    const current = clusters[clusters.length - 1];
    if (current && o.amount <= start * (1 + 2 * AMOUNT_TOLERANCE)) {
      current.push(o);
    } else {
      clusters.push([o]);
      start = o.amount;
    }
  }
  return clusters;
}

export function detectRecurring(entries: Entry[]): RecurringPayment[] {
  const byKey = new Map<string, Occurrence[]>();
  for (const e of entries) {
    if (e.tx.amount >= 0 || NOT_RECURRING.includes(e.cat)) continue;
    const key = merchantKey(e.tx);
    const list = byKey.get(key) ?? [];
    list.push({ entry: e, amount: -e.tx.amount });
    byKey.set(key, list);
  }

  const result: RecurringPayment[] = [];
  for (const occs of byKey.values()) {
    if (occs.length < 2) continue;
    for (const cluster of clusterByAmount(occs)) {
      const found = evaluate(cluster);
      if (found) result.push(found);
    }
  }

  result.sort((a, b) => b.monthlyCost - a.monthlyCost || a.name.localeCompare(b.name));
  return result;
}

function evaluate(cluster: Occurrence[]): RecurringPayment | null {
  if (cluster.length < 2) return null;

  // Keep amounts within ±15% of the cluster median.
  const m = median(cluster.map((o) => o.amount));
  const close = cluster.filter((o) => Math.abs(o.amount - m) <= m * AMOUNT_TOLERANCE);

  // Collapse same-day duplicates (keep the first), then order chronologically.
  const byDay = new Map<number, Occurrence>();
  for (const o of [...close].sort((a, b) => a.entry.day - b.entry.day)) {
    if (!byDay.has(o.entry.day)) byDay.set(o.entry.day, o);
  }
  const occs = [...byDay.values()];
  if (occs.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < occs.length; i++) intervals.push(occs[i].entry.day - occs[i - 1].entry.day);

  const win = windowFor(median(intervals));
  if (!win || occs.length < win.minOccurrences) return null;
  const consistent = intervals.filter((d) => d >= win.min && d <= win.max).length;
  if (consistent / intervals.length < MIN_INTERVAL_CONSISTENCY) return null;

  const amount = median(occs.map((o) => o.amount));
  const naming = new MerchantNaming();
  for (const o of occs) naming.add(o.entry.tx, o.entry.cat);

  return {
    name: naming.name,
    category: naming.category,
    amount: round2(amount),
    frequency: win.frequency,
    monthlyCost: round2(amount * MONTHLY_FACTOR[win.frequency]),
    occurrences: occs.length,
  };
}
