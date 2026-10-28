import type { ParseResult } from "@/lib/types";

// CONTRACT (owned by the parser agent): runs in the browser.
// Detects the format (CSV / CAMT.053/054 XML / XLSX / PDF) and returns normalised transactions.
export async function parseStatement(file: File): Promise<ParseResult> {
  void file;
  throw new Error("parseStatement: not implemented");
}

// CONTRACT: built-in demo statement (realistic Swiss data, ~3 months) for the "try with sample" button.
export function getSampleStatement(): ParseResult {
  throw new Error("getSampleStatement: not implemented");
}
