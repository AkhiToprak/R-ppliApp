import type { Analysis, Transaction } from "@/lib/types";

// CONTRACT (owned by the analysis agent): pure, synchronous, works in browser and node.
export function analyse(transactions: Transaction[]): Analysis {
  void transactions;
  throw new Error("analyse: not implemented");
}
