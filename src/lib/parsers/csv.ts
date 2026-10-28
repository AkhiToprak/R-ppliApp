import Papa from "papaparse";
import { parseTable, type TableParseOutput } from "./table";

const DELIMITERS = [";", "\t", ",", "|"] as const;

/** Splits CSV text into rows, choosing the delimiter that yields the most consistent wide table. */
export function splitCsv(text: string): string[][] {
  let bestRows: string[][] = [];
  let bestScore = -1;
  for (const delimiter of DELIMITERS) {
    const res = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false, header: false });
    const rows = res.data.filter((r): r is string[] => Array.isArray(r));
    const counts = new Map<number, number>();
    for (const r of rows) {
      const filled = r.length;
      if (filled >= 3) counts.set(filled, (counts.get(filled) ?? 0) + 1);
    }
    let score = 0;
    for (const [width, n] of counts) score = Math.max(score, n * Math.min(width, 12));
    if (score > bestScore) {
      bestScore = score;
      bestRows = rows;
    }
  }
  return bestRows;
}

/** Parses decoded CSV/TXT statement text. */
export function parseCsvText(text: string): TableParseOutput {
  return parseTable(splitCsv(text));
}
