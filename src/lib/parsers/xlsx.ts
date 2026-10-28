import { parseTable, type TableParseOutput } from "./table";
import { StatementParseError } from "./errors";

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    // SheetJS creates dates at local midnight, sometimes a few seconds off (historic TZ offsets):
    // nudge those back to the intended calendar day.
    const use = v.getHours() === 23 && v.getMinutes() === 59 ? new Date(v.getTime() + 60_000) : v;
    const y = use.getFullYear();
    const m = String(use.getMonth() + 1).padStart(2, "0");
    const day = String(use.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  return String(v);
}

/** Parses XLSX / XLS (and HTML-table "xls") workbooks: first sheet with transactions wins. */
export async function parseXlsx(data: ArrayBuffer | Uint8Array): Promise<TableParseOutput> {
  const XLSX = await import("xlsx");
  let wb: import("xlsx").WorkBook;
  try {
    wb = XLSX.read(data instanceof Uint8Array ? data : new Uint8Array(data), { type: "array", cellDates: true, dense: true });
  } catch (err) {
    throw new StatementParseError("unsupported_format", "Could not read the spreadsheet.", { cause: err });
  }
  let first: TableParseOutput | null = null;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: true });
    const result = parseTable(rows.map((r) => (Array.isArray(r) ? r.map(cellToString) : [])));
    first ??= result;
    if (result.transactions.length > 0) return result;
  }
  return first ?? { transactions: [], warnings: ["The workbook contains no sheets."], headerFound: false };
}
