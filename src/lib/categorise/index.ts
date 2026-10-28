import type { Locale, Transaction } from "@/lib/types";

// CONTRACT (owned by the categoriser agent): runs in the browser.
// 1) rule-based Swiss merchant matching, 2) POST /api/categorise for the rest (deduplicated),
// 3) "other" fallback if the API fails. Never throws for API errors.
export async function categoriseTransactions(
  transactions: Transaction[],
  locale: Locale,
  onProgress?: (done: number, total: number) => void,
): Promise<Transaction[]> {
  void locale;
  void onProgress;
  return transactions;
}
