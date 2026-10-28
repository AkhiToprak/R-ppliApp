import type { CategoryId, MerchantTotal, Transaction } from "@/lib/types";
import { bump, mostCommon, round2, type Entry } from "./prepare";

const UNKNOWN = "Unknown";

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9Ͱ-￿]+/g, " ")
    .trim();
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Normalised grouping key. With a counterparty: case/diacritic/punctuation
 * insensitive, purely numeric tokens dropped. Without: description cleaned of digits.
 */
export function merchantKey(tx: Transaction): string {
  const cp = tx.counterparty?.trim();
  if (cp) {
    const key = fold(cp)
      .split(" ")
      .filter((tok) => tok !== "" && !/^\d+$/.test(tok))
      .join(" ");
    if (key) return key;
  }
  return fold(tx.description.replace(/\d+/g, " ")) || "unknown";
}

/** Display spelling of a transaction's merchant (before picking the most common one). */
export function merchantSpelling(tx: Transaction): string {
  const cp = tx.counterparty?.trim();
  if (cp) return collapse(cp);
  return collapse(tx.description.replace(/\d+/g, " ")) || UNKNOWN;
}

/** Tracks spellings and categories seen for one merchant key. */
export class MerchantNaming {
  private spellings = new Map<string, number>();
  private categories = new Map<CategoryId, number>();

  add(tx: Transaction, cat: CategoryId): void {
    bump(this.spellings, merchantSpelling(tx));
    bump(this.categories, cat);
  }

  get name(): string {
    return mostCommon(this.spellings) ?? UNKNOWN;
  }

  get category(): CategoryId {
    return mostCommon(this.categories) ?? "other";
  }
}

/**
 * Top spending merchants. `entries` must already be spending-category rows.
 * Refunds with the same merchant key reduce the merchant's total.
 */
export function topMerchants(entries: Entry[], limit = 10): MerchantTotal[] {
  const groups = new Map<
    string,
    { naming: MerchantNaming; net: number; count: number; months: Set<string> }
  >();
  for (const e of entries) {
    const key = merchantKey(e.tx);
    let g = groups.get(key);
    if (!g) {
      g = { naming: new MerchantNaming(), net: 0, count: 0, months: new Set() };
      groups.set(key, g);
    }
    g.net += -e.tx.amount;
    if (e.tx.amount < 0) {
      g.count += 1;
      g.months.add(e.month);
      g.naming.add(e.tx, e.cat);
    }
  }
  const list: MerchantTotal[] = [];
  for (const g of groups.values()) {
    if (g.net <= 0 || g.count === 0) continue;
    list.push({
      name: g.naming.name,
      category: g.naming.category,
      total: round2(g.net),
      count: g.count,
      months: g.months.size,
    });
  }
  list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return list.slice(0, limit);
}
