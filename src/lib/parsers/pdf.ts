// PDF statements: text extraction with pdf.js (browser only), a heuristic line parser,
// and an LLM fallback (/api/extract) fed with redacted text.

import type { ExtractResponse } from "@/lib/types";
import { detectBankFromText } from "./banks";
import { StatementParseError } from "./errors";
import type { RawTransaction } from "./normalise";
import { redact } from "./redact";
import { parseAmount, parseDate, round2 } from "./values";

export type ExtractFn = (redactedText: string) => Promise<ExtractResponse>;

export interface PdfParseOutput {
  transactions: RawTransaction[];
  bank?: string;
  currency?: string;
  warnings: string[];
}

// ---- text extraction (browser) ------------------------------------------------

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * Loads pdf.js lazily (client only) and points it at its worker.
 * `new URL("pdfjs-dist/…", import.meta.url)` is recognised by Turbopack (and webpack) as an asset
 * reference: the worker file is emitted unchanged under /_next/static/media and the expression
 * becomes its URL. pdf.js then spawns it as a module worker itself.
 */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc && !pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    }
    return pdfjs;
  });
  return pdfjsPromise;
}

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rebuilds visual lines from positioned text items (grouped by y, ordered by x). */
export function itemsToLines(items: readonly Item[]): string[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Item[][] = [];
  for (const it of sorted) {
    const line = lines[lines.length - 1];
    const tol = Math.max(2, (it.h || 10) * 0.45);
    if (line && Math.abs(line[0].y - it.y) <= tol) line.push(it);
    else lines.push([it]);
  }
  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    let out = "";
    let prevEnd = -Infinity;
    for (const it of line) {
      const gap = it.x - prevEnd;
      const h = it.h || 10;
      if (out) out += gap > h * 1.2 ? "   " : gap > h * 0.15 && !out.endsWith(" ") ? " " : "";
      out += it.str;
      prevEnd = it.x + it.w;
    }
    return out.replace(/\s+$/, "");
  });
}

/** Extracts text lines from a PDF. Browser only. */
export async function extractPdfLines(data: ArrayBuffer | Uint8Array): Promise<string[]> {
  if (typeof window === "undefined") {
    throw new StatementParseError("pdf_extraction_failed", "PDF parsing is only available in the browser.");
  }
  let pdfjs: PdfJs;
  try {
    pdfjs = await loadPdfJs();
  } catch (err) {
    pdfjsPromise = null;
    throw new StatementParseError("pdf_extraction_failed", "Could not load the PDF engine.", { cause: err });
  }
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
  const task = pdfjs.getDocument({ data: bytes });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (err) {
    void task.destroy();
    throw new StatementParseError("pdf_extraction_failed", "The PDF could not be opened (encrypted or damaged?).", {
      cause: err,
    });
  }
  const lines: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const t = raw.transform as number[];
        items.push({ str: raw.str, x: t[4], y: t[5], w: raw.width, h: raw.height || Math.abs(t[3]) });
      }
      lines.push(...itemsToLines(items), "");
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return lines;
}

// ---- heuristic line parser ------------------------------------------------------

const DATE_START =
  /^\s*(\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\.?\s+[A-Za-zÀ-ÿ]{3,9}\.?\s+\d{4})(?=\s|$)/;
const AMOUNT_CORE = String.raw`-?(?:\d{1,3}(?:['’]\d{3})+|\d{1,3}(?:\.\d{3})+(?=,)|\d+)[.,]\d{2}-?`;
const AMOUNT_CORE_SPACED = String.raw`-?(?:\d{1,3}(?:['’  ]\d{3})+|\d{1,3}(?:\.\d{3})+(?=,)|\d+)[.,]\d{2}-?`;
const OPENING_RE =
  /(saldovortrag|anfangssaldo|er(?:ö|oe)ffnungssaldo|alter saldo|saldo (?:per|am|au)|solde (?:initial|pr(?:é|e)c(?:é|e)dent|report(?:é|e)?)|saldo (?:iniziale|precedente)|opening balance|previous balance|(?:ü|ue)bertrag|report)/i;
const SUMMARY_RE =
  /\b(total|totale|summe|zwischensumme|umsatz(?:total|summe)|saldo|solde|kontostand|closing balance|schlusssaldo|neuer saldo|seite \d|page \d|pagina \d)\b/i;
const CREDIT_HINT =
  /gutschrift|eingang|lohn|gehalt|sal(?:ä|ae|a)r|salaire|stipendio|r(?:ü|ue)ckerstattung|refund|rembourse|rimborso|einzahlung|versement|zins(?:gutschrift)?|interest|cr(?:é|e)dit|accredito|bonifico a vostro favore|incoming/i;

interface PdfHeuristicResult {
  transactions: RawTransaction[];
  reliable: boolean;
  /** How the signs were determined, for warnings. */
  signSource: "balance" | "explicit" | "keywords" | "none";
}

function trailingAmounts(line: string): { amounts: { value: number; explicit: boolean }[]; rest: string } {
  const spaced = /\S\s{2,}\S/.test(line);
  const core = spaced ? AMOUNT_CORE_SPACED : AMOUNT_CORE;
  const re = new RegExp(String.raw`(?:^|\s)(${core})(?:\s*(?:CHF|EUR|USD|GBP))?\s*$`);
  const amounts: { value: number; explicit: boolean }[] = [];
  const trailingDate = /\s+(?:\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2})$/;
  let rest = line;
  for (let k = 0; k < 3; k++) {
    // value-date columns may sit between / after the amount columns
    rest = rest.trimEnd().replace(trailingDate, "");
    const m = re.exec(rest);
    if (!m) break;
    const value = parseAmount(m[1]);
    if (value === null) break;
    amounts.unshift({ value, explicit: /-/.test(m[1]) });
    rest = rest.slice(0, m.index).replace(/\s*(?:CHF|EUR|USD|GBP)\s*$/, "");
  }
  return { amounts, rest };
}

/** Parses reconstructed PDF text lines: date at line start + amount(s) at line end. */
export function parsePdfLines(lines: readonly string[]): PdfHeuristicResult {
  const out: (RawTransaction & { explicit: boolean; verified: boolean; keyword: boolean })[] = [];
  let balance: number | null = null;
  let current: (typeof out)[number] | null = null;
  let continuation = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      current = null;
      continue;
    }
    const dm = DATE_START.exec(line);
    const { amounts, rest } = trailingAmounts(line);

    if (!dm) {
      if (amounts.length && OPENING_RE.test(line)) {
        balance = amounts[amounts.length - 1].value;
        current = null;
        continue;
      }
      if (current && !amounts.length && continuation < 3 && line.trim().length < 140 && !SUMMARY_RE.test(line)) {
        current.description = `${current.description} ${line.trim()}`;
        continuation++;
      } else if (amounts.length) {
        current = null;
      }
      continue;
    }

    const date = parseDate(dm[1]);
    if (!date || amounts.length === 0) {
      current = null;
      continue;
    }
    let desc = rest.slice(dm.index + dm[0].length).trim();
    // a second date (value date) right after the booking date or at the end of the text
    desc = desc.replace(DATE_START, "").trim();
    desc = desc.replace(/\s+\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2})$/, "").trim();
    if (OPENING_RE.test(desc) || (SUMMARY_RE.test(desc) && desc.length < 40)) {
      balance = amounts[amounts.length - 1].value;
      current = null;
      continue;
    }

    let amount: number;
    let verified = false;
    let explicit = false;
    let keyword = false;
    let newBalance: number | null = null;
    if (amounts.length >= 2) {
      newBalance = amounts[amounts.length - 1].value;
      const candidates = amounts.slice(0, -1).filter((a) => a.value !== 0);
      const main = candidates[candidates.length - 1] ?? amounts[0];
      const a = Math.abs(main.value);
      if (balance !== null && Math.abs(balance - a - newBalance) < 0.011) {
        amount = -a;
        verified = true;
      } else if (balance !== null && Math.abs(balance + a - newBalance) < 0.011) {
        amount = a;
        verified = true;
      } else if (main.explicit || main.value < 0) {
        amount = -a;
        explicit = true;
      } else {
        amount = CREDIT_HINT.test(desc) ? a : -a;
        keyword = true;
      }
    } else {
      const only = amounts[0];
      if (only.value < 0) {
        amount = only.value;
        explicit = true;
      } else {
        amount = CREDIT_HINT.test(desc) ? only.value : -only.value;
        keyword = true;
      }
    }
    if (newBalance !== null) balance = newBalance;
    else if (balance !== null) balance = round2(balance + amount);

    if (!desc) desc = "—";
    current = { date, description: desc, amount, explicit, verified, keyword };
    continuation = 0;
    out.push(current);
  }

  const n = out.length;
  const verified = out.filter((t) => t.verified).length;
  const negatives = out.filter((t) => t.explicit).length;
  const positivesWithoutKeyword = out.filter((t) => t.amount > 0 && !t.keyword).length;
  let signSource: PdfHeuristicResult["signSource"] = "none";
  let reliable = false;
  if (n >= 3 && verified / n >= 0.7) {
    signSource = "balance";
    reliable = true;
  } else if (n >= 3 && negatives > 0 && (negatives + positivesWithoutKeyword) / n >= 0.5) {
    signSource = "explicit";
    reliable = true;
  } else if (n > 0) {
    signSource = "keywords";
  }
  return {
    transactions: out.map(({ date, description, amount }) => ({ date, description, amount })),
    reliable,
    signSource,
  };
}

// ---- LLM fallback ---------------------------------------------------------------

/** Validates and converts an /api/extract response into raw transactions. */
export function normaliseExtracted(res: ExtractResponse | null | undefined): RawTransaction[] {
  if (!res || !Array.isArray(res.transactions)) return [];
  const fallbackCcy = typeof res.currency === "string" && /^[A-Z]{3}$/i.test(res.currency) ? res.currency.toUpperCase() : undefined;
  const out: RawTransaction[] = [];
  for (const t of res.transactions as unknown[]) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const date = parseDate(o.date);
    const amount = typeof o.amount === "number" ? o.amount : parseAmount(o.amount);
    if (!date || amount === null || !Number.isFinite(amount) || amount === 0) continue;
    const description = typeof o.description === "string" ? o.description : "";
    const currency = typeof o.currency === "string" && /^[A-Z]{3}$/i.test(o.currency) ? o.currency.toUpperCase() : fallbackCcy;
    const counterparty = typeof o.counterparty === "string" && o.counterparty.trim() ? o.counterparty : undefined;
    out.push({ date, description, amount, currency, counterparty });
  }
  return out;
}

async function defaultExtract(text: string): Promise<ExtractResponse> {
  const { extractFromText } = await import("@/lib/llm/client");
  return extractFromText(text);
}

/**
 * Turns extracted PDF lines into transactions: heuristic first, LLM (/api/extract) when the
 * heuristic finds < 3 transactions or cannot determine signs reliably.
 */
export async function parsePdfText(lines: readonly string[], extract: ExtractFn = defaultExtract): Promise<PdfParseOutput> {
  const text = lines.join("\n");
  if (text.replace(/\s/g, "").length < 20) {
    throw new StatementParseError("pdf_extraction_failed", "The PDF contains no text layer (scanned document?).");
  }
  const bank = detectBankFromText(text.slice(0, 5000));
  const heuristic = parsePdfLines(lines);
  if (heuristic.reliable) {
    return { transactions: heuristic.transactions, bank, warnings: [] };
  }

  const warnings: string[] = [];
  try {
    const res = await extract(redact(text));
    const txs = normaliseExtracted(res);
    if (txs.length > 0) {
      warnings.push("Transactions were extracted from the PDF with AI assistance; please double-check them.");
      return { transactions: txs, bank: res.bank || bank, currency: res.currency || undefined, warnings };
    }
    warnings.push("AI-assisted PDF extraction returned no transactions.");
  } catch (err) {
    warnings.push(`AI-assisted PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (heuristic.transactions.length > 0) {
    warnings.push(
      heuristic.signSource === "keywords"
        ? "Debit/credit signs in this PDF were guessed from the booking text; please double-check."
        : "Only a few transactions could be read from this PDF; please double-check.",
    );
    return { transactions: heuristic.transactions, bank, warnings };
  }
  throw new StatementParseError("pdf_extraction_failed", "No transactions could be read from the PDF.");
}

/** Full PDF pipeline. `extractLines` is injectable for tests (pdf.js needs a browser). */
export async function parsePdf(
  data: ArrayBuffer | Uint8Array,
  deps: { extract?: ExtractFn; extractLines?: (data: ArrayBuffer | Uint8Array) => Promise<string[]> } = {},
): Promise<PdfParseOutput> {
  const lines = await (deps.extractLines ?? extractPdfLines)(data);
  return parsePdfText(lines, deps.extract);
}
