import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseStatementData } from "./index";

describe("XLSX", () => {
  it("parses the first sheet through the table pipeline", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Kontoauszug Migros Bank"],
      [],
      ["Datum", "Buchungstext", "Betrag", "Valuta", "Saldo"],
      [new Date(2026, 6, 3), "Einkauf Debitkarte DENNER ZUERICH", -18.35, new Date(2026, 6, 3), 981.65],
      [new Date(2026, 6, 25), "Gutschrift Lohn", 6800, new Date(2026, 6, 25), 7781.65],
      ["02.07.2026", "Zahlung Debitkarte Galaxus.ch", "-149.00", "02.07.2026", "1000.00"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Umsätze");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const res = await parseStatementData(buf, "umsaetze.xlsx");
    expect(res.format).toBe("xlsx");
    expect(res.bank).toBe("Migros Bank");
    expect(res.transactions.map((t) => [t.date, t.amount])).toEqual([
      ["2026-07-02", -149],
      ["2026-07-03", -18.35],
      ["2026-07-25", 6800],
    ]);
    expect(res.transactions[1].counterparty).toBe("Denner");
  });
});
