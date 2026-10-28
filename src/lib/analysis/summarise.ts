import type { Analysis, Transaction } from "@/lib/types";

const MAX_MERCHANTS = 10;
const MAX_RECURRING = 15;
const MAX_EXPENSES = 5;
const MAX_MONTHS = 12;
const MAX_DESCRIPTION = 40;

/** Without a counterparty, keep a short description with long digit runs (IBANs, refs) removed. */
function safeDescription(tx: Transaction): string {
  const cp = tx.counterparty?.trim();
  if (cp) return cp;
  return tx.description
    .replace(/\d{5,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

/**
 * Compact, aggregated copy of an Analysis that is safe to send to the LLM.
 * Does not mutate the input. The `id` of largestExpenses is blanked (the type
 * requires a string) and their description is replaced by the counterparty.
 */
export function summariseForLLM(analysis: Analysis): Analysis {
  return {
    ...analysis,
    period: { ...analysis.period },
    byCategory: analysis.byCategory.map((c) => ({ ...c })),
    byMonth: analysis.byMonth.slice(-MAX_MONTHS).map((m) => ({
      ...m,
      byCategory: { ...m.byCategory },
    })),
    topMerchants: analysis.topMerchants.slice(0, MAX_MERCHANTS).map((m) => ({ ...m })),
    recurring: analysis.recurring.slice(0, MAX_RECURRING).map((r) => ({ ...r })),
    largestExpenses: analysis.largestExpenses.slice(0, MAX_EXPENSES).map((t) => {
      const copy: Transaction = { ...t, id: "", description: safeDescription(t) };
      return copy;
    }),
    weekdaySpending: [...analysis.weekdaySpending],
  };
}
