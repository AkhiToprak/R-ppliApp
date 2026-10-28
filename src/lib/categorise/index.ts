import {
  CATEGORY_IDS,
  type CategoriseRequest,
  type CategoriseResponse,
  type CategoryId,
  type Locale,
  type Transaction,
} from "@/lib/types";
import { categoriseByRules } from "./rules";

// Runs in the browser:
// 1) rule-based Swiss merchant matching,
// 2) POST /api/categorise for the rest (deduplicated by merchant key, batches of <= 80),
// 3) "other" fallback if the API fails. API / network errors never throw.

export { categoriseByRules, normaliseText, RULE_COUNT, RULE_PATTERN_COUNT } from "./rules";
export type { RuleMatch } from "./rules";

const BATCH_SIZE = 80;
const CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_MERCHANT_LENGTH = 60;

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORY_IDS);

function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

/**
 * Deduplication key: counterparty (or description) lower-cased, digits and punctuation stripped.
 * Empty string when nothing usable is left.
 */
export function merchantKey(tx: Pick<Transaction, "counterparty" | "description">): string {
  const base = tx.counterparty?.trim() || tx.description;
  return base
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

interface Group {
  key: string;
  description: string;
  amount: number;
  indices: number[];
}

interface Verdict {
  category: CategoryId;
  merchant?: string;
}

function describe(tx: Transaction): string {
  const cp = tx.counterparty?.trim();
  const text =
    cp && !tx.description.toLowerCase().includes(cp.toLowerCase()) ? `${cp} | ${tx.description}` : tx.description;
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_LENGTH);
}

async function postBatch(
  group: Group[],
  locale: Locale,
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  const body: CategoriseRequest = {
    locale,
    items: group.map((g) => ({ key: g.key, description: g.description, amount: g.amount })),
  };
  const amountByKey = new Map(group.map((g) => [g.key, g.amount]));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("/api/categorise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return out;
    const data = (await res.json()) as Partial<CategoriseResponse> | null;
    if (!data || !Array.isArray(data.results)) return out;
    for (const r of data.results) {
      if (!r || typeof r.key !== "string" || !amountByKey.has(r.key) || !isCategoryId(r.category)) continue;
      // Income only makes sense for incoming money.
      const amount = amountByKey.get(r.key) ?? 0;
      const category: CategoryId = r.category === "income" && amount < 0 ? "other" : r.category;
      const merchant =
        typeof r.merchant === "string" && r.merchant.trim()
          ? r.merchant.trim().slice(0, MAX_MERCHANT_LENGTH)
          : undefined;
      out.set(r.key, { category, merchant });
    }
  } catch {
    // network error, abort, invalid JSON: fall back
  } finally {
    clearTimeout(timer);
  }
  return out;
}

/**
 * Categorise all transactions. Transactions that already carry a category from a previous
 * "rule" / "llm" run (including manual corrections via {@link recategorise}) are left untouched.
 * `onProgress(done, total)` counts finished LLM batches (called with (0, total) up front);
 * it is not called at all when the rules resolved everything.
 */
export async function categoriseTransactions(
  transactions: Transaction[],
  locale: Locale,
  onProgress?: (done: number, total: number) => void,
): Promise<Transaction[]> {
  const result: Transaction[] = transactions.map((tx) => ({ ...tx }));
  const groups = new Map<string, Group>();

  result.forEach((tx, i) => {
    if (tx.category && (tx.categorySource === "rule" || tx.categorySource === "llm")) return;

    const hit = categoriseByRules(tx);
    if (hit) {
      tx.category = hit.category;
      tx.categorySource = "rule";
      if (hit.merchant && !hasText(tx.counterparty)) tx.counterparty = hit.merchant;
      return;
    }

    const mk = merchantKey(tx);
    if (!mk) {
      tx.category = "other";
      tx.categorySource = "fallback";
      return;
    }
    // Keep income-ish and spending-ish bookings of the same name apart.
    const gk = `${tx.amount > 0 ? "+" : "-"}|${mk}`;
    const existing = groups.get(gk);
    if (existing) existing.indices.push(i);
    else groups.set(gk, { key: `g${groups.size}`, description: describe(tx), amount: tx.amount, indices: [i] });
  });

  const all = [...groups.values()];
  const batches: Group[][] = [];
  for (let i = 0; i < all.length; i += BATCH_SIZE) batches.push(all.slice(i, i + BATCH_SIZE));

  const verdicts = new Map<string, Verdict>();
  if (batches.length > 0) {
    let done = 0;
    let next = 0;
    onProgress?.(0, batches.length);
    const worker = async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        const got = await postBatch(batch, locale);
        got.forEach((v, k) => verdicts.set(k, v));
        done++;
        onProgress?.(done, batches.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  }

  for (const g of all) {
    const v = verdicts.get(g.key);
    for (const i of g.indices) {
      const tx = result[i];
      if (v) {
        tx.category = v.category;
        tx.categorySource = "llm";
        if (v.merchant && !hasText(tx.counterparty)) tx.counterparty = v.merchant;
      } else {
        tx.category = "other";
        tx.categorySource = "fallback";
      }
    }
  }
  return result;
}

/**
 * Manual correction. Returns a new array in which transaction `id` (and, with
 * `applyToMerchant`, every other transaction with the same merchant key and the same sign)
 * has `category` with `categorySource: "rule"`.
 */
export function recategorise(
  transactions: Transaction[],
  id: string,
  category: CategoryId,
  applyToMerchant = false,
): Transaction[] {
  const target = transactions.find((t) => t.id === id);
  if (!target) return transactions.slice();
  const key = applyToMerchant ? merchantKey(target) : "";
  const positive = target.amount > 0;
  return transactions.map((t) => {
    const same = t.id === id || (key !== "" && t.amount > 0 === positive && merchantKey(t) === key);
    return same ? { ...t, category, categorySource: "rule" } : t;
  });
}
