import { describe, expect, it } from "vitest";
import { cleanCounterparty } from "./counterparty";

describe("cleanCounterparty", () => {
  it.each([
    ["Einkauf ZKB Maestro Karte Nr. xxxx 1234, MIGROS M ZUERICH HB ZUERICH", "Migros Zürich HB"],
    ["Debitkarten-Belastung COOP-1832 ZUERICH", "Coop"],
    ["Zahlung Debitkarte 03.07.2026 14:22 Denner Zürich Rosengarten", "Denner Zürich Rosengarten"],
    ["TWINT *Kafi Dihei", "Kafi Dihei"],
    ["TWINT Kauf/Dienstleistung vom 05.07.2026, Bäckerei Hug Luzern", "Bäckerei Hug Luzern"],
    ["Kartenzahlung UBER *EATS HELP.UBER.COM", "Uber Eats"],
    ["Paiement carte 12.07.2026 MANOR LAUSANNE", "Manor"],
    ["Pagamento carta 12.07.2026 COOP-4411 LUGANO", "Coop"],
    ["E-Banking Auftrag Immo Limmat AG", "Immo Limmat AG"],
    ["Gutschrift Alpenblick Software AG", "Alpenblick Software AG"],
    ["KAUF/DIENSTLEISTUNG VOM 30.07.2026 KARTEN NR. XXXX1234 MIGROS MM LIMMATPLATZ ZUERICH", "Migros Limmatplatz"],
    ["PAYPAL *NETFLIX", "Netflix"],
    ["Galaxus.ch; 8005 Zürich; Transaktions-Nr. 9930273TI1234567", "Galaxus.ch"],
    ["Brockenhaus Zürich", "Brockenhaus Zürich"],
    ["TWINT Geld senden an Lea Baumann +41 79 412 33 18", "Lea Baumann"],
    ["SBB CFF FFS ZUERICH HB", "SBB CFF FFS Zürich HB"],
    ["Belastung Spotify P2F3A1 Stockholm", "Spotify"],
    ["Einkauf Debitkarte Nr. XXXX 4821, AIRBNB * HMQ4E2X8 LONDON", "Airbnb"],
    ["Belastung Netflix.com Los Gatos", "Netflix.com"],
    ["Kafi Dihei, Zürich", "Kafi Dihei"],
  ])("%s → %s", (input, expected) => {
    expect(cleanCounterparty(input)).toBe(expected);
  });

  it("returns undefined when nothing meaningful is left", () => {
    expect(cleanCounterparty("Debitkarten-Belastung 03.07.2026 1234567")).toBeUndefined();
    expect(cleanCounterparty("")).toBeUndefined();
  });
});
