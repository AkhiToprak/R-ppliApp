import type { ParseResult } from "@/lib/types";
import { parseCamt } from "./camt";
import { parseCsvText } from "./csv";
import { detectFormat } from "./detect";
import { decodeText } from "./encoding";
import { MAX_FILE_SIZE, StatementParseError } from "./errors";
import { finaliseTransactions } from "./normalise";
import { parsePdf, type ExtractFn } from "./pdf";
import { buildSampleStatement } from "./sample";
import type { TableParseOutput } from "./table";
import { parseXlsx } from "./xlsx";

export { StatementParseError, isStatementParseError, MAX_FILE_SIZE } from "./errors";
export type { StatementParseErrorCode } from "./errors";
export { redact } from "./redact";
export { cleanCounterparty } from "./counterparty";

export interface ParseOptions {
  /** Override for the PDF → LLM extraction call (defaults to extractFromText from @/lib/llm/client). */
  extract?: ExtractFn;
  /** Override for PDF text extraction (defaults to pdf.js, browser only). */
  extractPdfLines?: (data: ArrayBuffer | Uint8Array) => Promise<string[]>;
}

function fromTable(out: TableParseOutput, format: "csv" | "xlsx"): ParseResult {
  if (out.transactions.length === 0) {
    throw new StatementParseError("no_transactions", out.warnings[0] ?? "No transactions found in the table.");
  }
  return finaliseTransactions(out.transactions, {
    format,
    bank: out.bank,
    currency: out.currency,
    warnings: out.warnings,
  });
}

/**
 * Environment-independent core of `parseStatement` (works in node/vitest for everything except
 * PDF text extraction, which needs pdf.js in the browser unless `extractPdfLines` is injected).
 */
export async function parseStatementData(
  data: ArrayBuffer | Uint8Array,
  fileName = "",
  options: ParseOptions = {},
): Promise<ParseResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength > MAX_FILE_SIZE) {
    throw new StatementParseError("file_too_large", "The file is larger than 15 MB.");
  }
  if (bytes.byteLength === 0) throw new StatementParseError("empty", "The file is empty.");

  const format = detectFormat(fileName, bytes);
  switch (format) {
    case "csv": {
      const text = decodeText(bytes);
      if (!text.trim()) throw new StatementParseError("empty", "The file is empty.");
      return fromTable(parseCsvText(text), "csv");
    }
    case "camt": {
      const out = parseCamt(decodeText(bytes));
      if (out.transactions.length === 0) {
        throw new StatementParseError("no_transactions", "The CAMT file contains no booked entries.");
      }
      return finaliseTransactions(out.transactions, {
        format: "camt",
        bank: out.bank,
        currency: out.currency,
        warnings: out.warnings,
      });
    }
    case "xlsx":
      return fromTable(await parseXlsx(bytes), "xlsx");
    case "pdf": {
      const out = await parsePdf(bytes, { extract: options.extract, extractLines: options.extractPdfLines });
      return finaliseTransactions(out.transactions, {
        format: "pdf",
        bank: out.bank,
        currency: out.currency,
        warnings: out.warnings,
      });
    }
    default:
      throw new StatementParseError("unsupported_format", `Unsupported file format: ${fileName || "unknown"}.`);
  }
}

// CONTRACT (owned by the parser agent): runs in the browser.
// Detects the format (CSV / CAMT.053/054 XML / XLSX / PDF) and returns normalised transactions.
// Throws StatementParseError (code: unsupported_format | empty | no_transactions | pdf_extraction_failed | file_too_large).
export async function parseStatement(file: File): Promise<ParseResult> {
  if (file.size > MAX_FILE_SIZE) throw new StatementParseError("file_too_large", "The file is larger than 15 MB.");
  if (file.size === 0) throw new StatementParseError("empty", "The file is empty.");
  const buffer = await file.arrayBuffer();
  return parseStatementData(buffer, file.name);
}

// CONTRACT: built-in demo statement (realistic Swiss data, ~3 months) for the "try with sample" button.
export function getSampleStatement(): ParseResult {
  return buildSampleStatement();
}
