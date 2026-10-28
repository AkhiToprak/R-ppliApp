import type { ParseResult, StatementFormat, Transaction } from "@/lib/types";
import { cleanCounterparty } from "./counterparty";
import { StatementParseError } from "./errors";
import { hashString, parseDate, round2 } from "./values";

/** Intermediate transaction produced by the format-specific parsers. */
export interface RawTransaction {
  /** ISO YYYY-MM-DD */
  date: string;
  description: string;
  amount: number;
  currency?: string;
  /** Explicit counterparty (e.g. CAMT Cdtr/Dbtr name); otherwise derived from the description. */
  counterparty?: string;
}

export const DEFAULT_CURRENCY = "CHF";
const MAX_WARNINGS = 15;

/** Collects warnings and collapses long lists into a summary line. */
export class WarningCollector {
  private readonly items: string[] = [];
  private overflow = 0;

  add(message: string): void {
    if (this.items.length < MAX_WARNINGS) this.items.push(message);
    else this.overflow++;
  }

  addAll(messages: readonly string[]): void {
    for (const m of messages) this.add(m);
  }

  list(): string[] {
    return this.overflow > 0 ? [...this.items, `…and ${this.overflow} more warnings.`] : [...this.items];
  }
}

export interface FinaliseOptions {
  format: StatementFormat;
  bank?: string;
  currency?: string;
  warnings?: readonly string[];
}

function dominantCurrency(txs: readonly RawTransaction[], fallback: string): string {
  const counts = new Map<string, number>();
  for (const t of txs) if (t.currency) counts.set(t.currency, (counts.get(t.currency) ?? 0) + 1);
  let best = fallback;
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

/**
 * Turns raw rows into contract `Transaction`s: validates, cleans text, derives counterparty,
 * removes exact duplicates, sorts by date ascending and assigns stable ids.
 * Throws `no_transactions` when nothing usable remains.
 */
export function finaliseTransactions(raw: readonly RawTransaction[], opts: FinaliseOptions): ParseResult {
  const warnings = new WarningCollector();
  warnings.addAll(opts.warnings ?? []);
  const fallbackCurrency = (opts.currency ?? DEFAULT_CURRENCY).toUpperCase();

  const cleaned: (Omit<Transaction, "id"> & { order: number })[] = [];
  let invalid = 0;
  raw.forEach((t, order) => {
    const date = parseDate(t.date);
    if (!date || typeof t.amount !== "number" || !Number.isFinite(t.amount)) {
      invalid++;
      return;
    }
    const description = String(t.description ?? "").replace(/\s+/g, " ").trim();
    const currency = (t.currency?.trim().toUpperCase() || fallbackCurrency).slice(0, 3);
    const counterparty = cleanCounterparty(t.counterparty) ?? cleanCounterparty(description);
    const tx: Omit<Transaction, "id"> & { order: number } = {
      date,
      description: description || counterparty || "—",
      amount: round2(t.amount),
      currency,
      order,
    };
    if (counterparty) tx.counterparty = counterparty;
    cleaned.push(tx);
  });
  if (invalid > 0) warnings.add(`Skipped ${invalid} transaction(s) with an invalid date or amount.`);

  // exact duplicates (same date, amount, currency and text)
  const seen = new Set<string>();
  const unique = cleaned.filter((t) => {
    const key = `${t.date}|${t.amount}|${t.currency}|${t.description.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const dupes = cleaned.length - unique.length;
  if (dupes > 0) warnings.add(`Removed ${dupes} duplicate transaction(s).`);

  unique.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));

  if (unique.length === 0) {
    throw new StatementParseError("no_transactions", "No transactions could be extracted from the statement.");
  }

  const transactions: Transaction[] = unique.map((t, index) => {
    const { order, ...rest } = t;
    void order;
    return { id: `tx_${hashString(`${t.date}|${t.amount}|${t.currency}|${t.description}|${index}`)}`, ...rest };
  });

  const result: ParseResult = {
    transactions,
    format: opts.format,
    currency: dominantCurrency(transactions, fallbackCurrency),
    warnings: warnings.list(),
  };
  if (opts.bank) result.bank = opts.bank;
  return result;
}
