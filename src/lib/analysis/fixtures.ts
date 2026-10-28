import type { CategoryId, Transaction } from "@/lib/types";

let seq = 0;

/** Test helper: builds a transaction with sensible defaults. */
export function tx(
  date: string,
  amount: number,
  category?: CategoryId,
  counterparty?: string,
  extra: Partial<Transaction> = {},
): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    date,
    description: counterparty ?? `Booking ${seq}`,
    counterparty,
    amount,
    currency: "CHF",
    category,
    ...extra,
  };
}

/** Adds `n` days to a YYYY-MM-DD date (UTC maths). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
