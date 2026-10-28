import { describe, expect, it } from "vitest";
import { detectDecimalSeparator, parseAmount, parseDate } from "./values";
import { decodeText } from "./encoding";

describe("parseAmount", () => {
  it.each([
    ["1'234.50", 1234.5],
    ["1’234.50", 1234.5],
    ["1 234,50", 1234.5],
    ["1 234,50", 1234.5],
    ["1 234,50", 1234.5],
    ["1.234,50", 1234.5],
    ["-1234.50", -1234.5],
    ["1234.50-", -1234.5],
    ["(12.50)", -12.5],
    ["CHF -12.50", -12.5],
    ["−12.50", -12.5],
    ["+6'800.00", 6800],
    ["12,5", 12.5],
    ["0.00", 0],
    ["1,234.56", 1234.56],
    ["1'234'567.80", 1234567.8],
    ["42", 42],
  ])("%s → %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("rejects non-numbers", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12.50.30,1,2")).toBeNull();
  });

  it("uses the column hint for ambiguous thousands", () => {
    expect(parseAmount("1,234")).toBe(1234);
    expect(parseAmount("1,234", ",")).toBe(1.234);
    expect(parseAmount("1.234", ",")).toBe(1234);
    expect(parseAmount("1.234")).toBe(1.234);
  });

  it("detects the decimal separator of a column", () => {
    expect(detectDecimalSeparator(["-12,50", "1 234,00", "3,1"])).toBe(",");
    expect(detectDecimalSeparator(["-12.50", "1'234.00"])).toBe(".");
  });
});

describe("parseDate", () => {
  it.each([
    ["03.07.2026", "2026-07-03"],
    ["3.7.2026", "2026-07-03"],
    ["03.07.26", "2026-07-03"],
    ["2026-07-03", "2026-07-03"],
    ["2026-07-03T14:22:01Z", "2026-07-03"],
    ["2026-07-03 14:22:01", "2026-07-03"],
    ["2026-07-03 00:00:00.0", "2026-07-03"],
    ["03/07/2026", "2026-07-03"],
    ["07/25/2026", "2026-07-25"],
    ["03-07-2026 10:15:22", "2026-07-03"],
    ["20260703", "2026-07-03"],
    ["3 Jul 2026", "2026-07-03"],
    ["03 juil. 2026", "2026-07-03"],
    ["3. Juli 2026", "2026-07-03"],
  ])("%s → %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it("rejects invalid dates", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("CHF")).toBeNull();
    expect(parseDate("12.50")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("decodeText", () => {
  it("strips a UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Währung")]);
    expect(decodeText(bytes)).toBe("Währung");
  });
  it("falls back to windows-1252", () => {
    const bytes = new Uint8Array([0x57, 0xe4, 0x68, 0x72, 0x75, 0x6e, 0x67, 0x3b, 0x80]); // "Währung;€"
    expect(decodeText(bytes)).toBe("Währung;€");
  });
  it("decodes UTF-16LE with BOM", () => {
    const s = "Datum;Betrag";
    const bytes = new Uint8Array(2 + s.length * 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    for (let i = 0; i < s.length; i++) bytes[2 + i * 2] = s.charCodeAt(i);
    expect(decodeText(bytes)).toBe(s);
  });
});
