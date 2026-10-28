import { describe, expect, it } from "vitest";
import { redact } from "./redact";

const STATEMENT = `Zürcher Kantonalbank
Herr
Max Muster
Bahnhofstrasse 12
8001 Zürich

Kontoauszug 01.07.2026 - 31.07.2026
IBAN CH93 0076 2011 6238 5295 7
Kontoinhaber: Max Muster
AHV-Nr. 756.1234.5678.97
Kontakt: max.muster@example.ch, Tel. +41 79 123 45 67 oder 044 123 45 67
Datum Text Belastung Gutschrift Saldo
03.07.2026 Einkauf ZKB Visa Debit Karte Nr. 4123 4567 8901 2345 Migros Zürich 45.30 1'954.70
04.07.2026 Einkauf Karte XXXX XXXX XXXX 1234 Coop 12.00 1'942.70
05.07.2026 Gutschrift Referenz 123456789012 Muster AG 6'800.00 8'742.70
06.07.2026 Zahlung an CH5604835012345678009 Miete 2'150.00 6'592.70`;

describe("redact", () => {
  const out = redact(STATEMENT);

  it("removes IBANs, card numbers, AHV numbers, e-mails and phone numbers", () => {
    expect(out).not.toContain("CH93 0076");
    expect(out).not.toContain("CH5604835012345678009");
    expect(out).not.toContain("4123 4567 8901 2345");
    expect(out).not.toContain("XXXX XXXX XXXX 1234");
    expect(out).not.toContain("756.1234.5678.97");
    expect(out).not.toContain("max.muster@example.ch");
    expect(out).not.toContain("79 123 45 67");
    expect(out).not.toContain("044 123 45 67");
    expect(out).not.toContain("123456789012");
    expect(out).toContain("[IBAN]");
    expect(out).toContain("[CARD]");
    expect(out).toContain("[AHV]");
    expect(out).toContain("[EMAIL]");
    expect(out).toContain("[PHONE]");
  });

  it("removes the holder's name and address block", () => {
    expect(out).not.toContain("Max Muster");
    expect(out).not.toContain("Bahnhofstrasse 12");
    expect(out).not.toContain("8001 Zürich");
  });

  it("keeps dates, merchants and amounts", () => {
    expect(out).toContain("03.07.2026");
    expect(out).toContain("Migros Zürich 45.30 1'954.70");
    expect(out).toContain("6'800.00");
    expect(out).toContain("Kontoauszug 01.07.2026 - 31.07.2026");
  });

  it("caps the length", () => {
    expect(redact("a".repeat(100_000)).length).toBe(60_000);
  });
});
