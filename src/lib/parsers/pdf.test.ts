import { describe, expect, it, vi } from "vitest";
import type { ExtractResponse } from "@/lib/types";
import { parseStatementData } from "./index";
import { itemsToLines, normaliseExtracted, parsePdfLines } from "./pdf";

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 fake");

const BALANCED = [
  "Raiffeisenbank Zürich",
  "Kontoauszug Juli 2026",
  "Datum      Text                                  Belastung   Gutschrift   Valuta       Saldo",
  "           Saldovortrag                                                                 1'000.00",
  "01.07.2026 Einkauf Debitkarte Migros Zürich HB      45.30                 01.07.2026     954.70",
  "02.07.2026 Gutschrift Alpenblick Software AG                     6'800.00  02.07.2026   7'754.70",
  "           Lohn Juli 2026",
  "03.07.2026 Dauerauftrag Immo Limmat AG            2'150.00                03.07.2026   5'604.70",
  "05.07.2026 TWINT Kafi Dihei                           11.50                05.07.2026   5'593.20",
  "           Total                                  2'206.80     6'800.00",
];

describe("PDF heuristic", () => {
  it("rebuilds lines from positioned text items", () => {
    const lines = itemsToLines([
      { str: "45.30", x: 400, y: 700, w: 30, h: 10 },
      { str: "01.07.2026", x: 50, y: 700.5, w: 50, h: 10 },
      { str: "Migros", x: 110, y: 699.8, w: 40, h: 10 },
      { str: "02.07.2026", x: 50, y: 680, w: 50, h: 10 },
    ]);
    expect(lines).toEqual(["01.07.2026 Migros   45.30", "02.07.2026"]);
  });

  it("parses dated lines and derives signs from the running balance", () => {
    const res = parsePdfLines(BALANCED);
    expect(res.reliable).toBe(true);
    expect(res.signSource).toBe("balance");
    expect(res.transactions.map((t) => [t.date, t.amount])).toEqual([
      ["2026-07-01", -45.3],
      ["2026-07-02", 6800],
      ["2026-07-03", -2150],
      ["2026-07-05", -11.5],
    ]);
    expect(res.transactions[1].description).toContain("Lohn Juli 2026");
  });

  it("uses the heuristic result without calling the LLM when reliable", async () => {
    const extract = vi.fn();
    const res = await parseStatementData(PDF_BYTES, "auszug.pdf", {
      extractPdfLines: async () => BALANCED,
      extract,
    });
    expect(extract).not.toHaveBeenCalled();
    expect(res.format).toBe("pdf");
    expect(res.bank).toBe("Raiffeisen");
    expect(res.transactions).toHaveLength(4);
  });

  it("falls back to the LLM with redacted text when unreliable", async () => {
    const lines = [
      "Herr",
      "Max Muster",
      "Bahnhofstrasse 1",
      "8001 Zürich",
      "IBAN CH93 0076 2011 6238 5295 7",
      "Some odd layout without dates per line",
      "Migros 45.30",
    ];
    const response: ExtractResponse = {
      currency: "CHF",
      bank: "UBS",
      transactions: [
        { date: "2026-07-01", description: "Migros Zürich", amount: -45.3, currency: "CHF" },
        { date: "03.07.2026", description: "Lohn", amount: 6800, currency: "CHF" },
        { date: "invalid", description: "x", amount: 1, currency: "CHF" },
      ],
    };
    const extract = vi.fn(async (text: string) => {
      expect(text).not.toContain("Max Muster");
      expect(text).not.toContain("CH93 0076");
      return response;
    });
    const res = await parseStatementData(PDF_BYTES, "auszug.pdf", { extractPdfLines: async () => lines, extract });
    expect(extract).toHaveBeenCalledOnce();
    expect(res.bank).toBe("UBS");
    expect(res.transactions.map((t) => [t.date, t.amount])).toEqual([
      ["2026-07-01", -45.3],
      ["2026-07-03", 6800],
    ]);
    expect(res.warnings.join(" ")).toMatch(/AI/);
  });

  it("throws pdf_extraction_failed when nothing can be read", async () => {
    await expect(
      parseStatementData(PDF_BYTES, "scan.pdf", { extractPdfLines: async () => ["", " "], extract: vi.fn() }),
    ).rejects.toMatchObject({ code: "pdf_extraction_failed" });
    await expect(
      parseStatementData(PDF_BYTES, "x.pdf", {
        extractPdfLines: async () => ["Kontoauszug ohne Buchungen, nur Text ohne Beträge"],
        extract: async () => {
          throw new Error("network");
        },
      }),
    ).rejects.toMatchObject({ code: "pdf_extraction_failed" });
  });

  it("validates LLM output", () => {
    expect(
      normaliseExtracted({
        currency: "chf",
        transactions: [
          { date: "2026-07-01", description: "A", amount: "-12.50" as unknown as number, currency: "" },
          { date: "2026-07-02", description: "B", amount: Number.NaN, currency: "CHF" },
        ],
      }),
    ).toEqual([{ date: "2026-07-01", description: "A", amount: -12.5, currency: "CHF", counterparty: undefined }]);
  });
});
