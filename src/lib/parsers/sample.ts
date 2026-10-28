// Deterministic demo statement: a young professional in Zürich, July–September 2026, CHF.
// Uses a fixed-seed PRNG so every call returns identical data.

import type { ParseResult } from "@/lib/types";
import { finaliseTransactions, type RawTransaction } from "./normalise";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTHS = [7, 8, 9] as const;
const MONTH_NAMES: Record<number, string> = { 7: "Juli", 8: "August", 9: "September" };
const DAYS_IN: Record<number, number> = { 7: 31, 8: 31, 9: 30 };
const CARD = "Debitkarte Nr. XXXX 4821";

function iso(month: number, day: number): string {
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 0 = Monday … 6 = Sunday */
function weekday(month: number, day: number): number {
  return (new Date(Date.UTC(2026, month - 1, day)).getUTCDay() + 6) % 7;
}

/** Shift weekend dates to the next Monday (bank bookings). */
function businessDay(month: number, day: number): string {
  let d = Math.min(day, DAYS_IN[month]);
  while (weekday(month, d) >= 5) d = d + 1 > DAYS_IN[month] ? d - 2 : d + 1;
  return iso(month, d);
}

function card(merchant: string): string {
  return `Einkauf ${CARD}, ${merchant}`;
}

function twint(merchant: string): string {
  return `TWINT Kauf/Dienstleistung, ${merchant}`;
}

export function buildSampleStatement(): ParseResult {
  const rnd = mulberry32(20260725);
  const between = (min: number, max: number) => Math.round((min + rnd() * (max - min)) * 20) / 20; // 5-Rappen steps
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
  const tx: RawTransaction[] = [];
  const add = (date: string, description: string, amount: number) =>
    tx.push({ date, description, amount: Math.round(amount * 100) / 100, currency: "CHF" });

  for (const m of MONTHS) {
    const mn = MONTH_NAMES[m];
    // --- income & fixed costs ---------------------------------------------------
    add(businessDay(m, 25), `Gutschrift Alpenblick Software AG, Lohn ${mn} 2026`, 6800);
    add(businessDay(m, 1), `Dauerauftrag Immo Limmat AG, Miete ${mn}`, -2150);
    add(businessDay(m, 1), `Dauerauftrag Immo Limmat AG, Nebenkosten Akonto ${mn}`, -180);
    add(businessDay(m, 3), `LSV CSS Kranken-Versicherung AG, Prämie ${mn}`, -412.35);
    add(businessDay(m, 6), "eBill Swisscom (Schweiz) AG, Mobile", -64.9);
    add(businessDay(m, 8), "LSV Sunrise GmbH, Internet", -49.0);
    add(iso(m, 2), card("SBB CFF FFS, ZVV Monatsabo Zone 110"), -89.0);
    add(iso(m, 12), "Belastung Netflix.com Los Gatos", -20.9);
    add(iso(m, 15), "Belastung Spotify P2F3A1 Stockholm", -13.95);
    add(iso(m, 18), "Belastung Disney Plus", -12.9);
    add(iso(m, 9), "Belastung APPLE.COM/BILL ITUNES.COM", -3.0);
    add(businessDay(m, 1), "LSV Activ Fitness AG, Abo", -89.0);
    add(businessDay(m, 26), "E-Banking Auftrag VIAC 3a Einzahlung", -588.0);
    add(iso(m, DAYS_IN[m]), "Preis für Bankpaket", -6.0);
    add(iso(m, pick([4, 5, 11, 18])), "Bargeldbezug Bancomat UBS Zürich HB", -pick([100, 200, 200, 300]));

    // --- groceries -----------------------------------------------------------------
    const grocers = [
      { name: "MIGROS M ZUERICH HB ZUERICH", min: 18, max: 95, weight: 4 },
      { name: "MIGROS MM LIMMATPLATZ ZUERICH", min: 22, max: 120, weight: 3 },
      { name: "COOP-1832 ZUERICH WIPKINGEN", min: 15, max: 110, weight: 3 },
      { name: "DENNER ZUERICH ROSENGARTEN", min: 9, max: 45, weight: 2 },
      { name: "LIDL SCHWEIZ ZUERICH", min: 20, max: 75, weight: 1 },
      { name: "ALDI SUISSE ZUERICH", min: 18, max: 70, weight: 1 },
      { name: "MIGROLINO ZUERICH HB", min: 4.5, max: 18, weight: 2 },
      { name: "COOP PRONTO ZUERICH WIPKINGEN", min: 5, max: 22, weight: 2 },
    ];
    const weighted = grocers.flatMap((g) => Array.from({ length: g.weight }, () => g));
    for (let d = 1; d <= DAYS_IN[m]; d += 2) {
      if (rnd() < 0.58) {
        const g = pick(weighted);
        add(iso(m, d), card(g.name), -between(g.min, g.max));
      }
    }

    // --- eating out ----------------------------------------------------------------
    const restaurants = [
      ["Hiltl AG Zürich", 28, 62],
      ["Tibits Zürich", 18, 34],
      ["Zeughauskeller Zürich", 42, 88],
      ["Sternen Grill Zürich", 9, 17],
      ["Cafe Henrici", 6, 19],
      ["Starbucks Zürich HB", 6.5, 12],
      ["Holy Cow Gourmet Burger", 21, 32],
      ["Rice Up Zürich", 17, 24],
    ] as const;
    for (let i = 0; i < 6; i++) {
      const [name, min, max] = pick(restaurants);
      add(iso(m, 2 + Math.floor(rnd() * (DAYS_IN[m] - 3))), rnd() < 0.5 ? card(name) : twint(name), -between(min, max));
    }
    add(iso(m, 10 + Math.floor(rnd() * 5)), "Kartenzahlung UBER *EATS HELP.UBER.COM", -between(24, 48));
    add(iso(m, 20 + Math.floor(rnd() * 6)), card("Just Eat Takeaway.com"), -between(22, 41));

    // --- TWINT with friends ----------------------------------------------------------
    const friends = ["Lea Baumann", "Jonas Keller", "Nina Frei", "Marco Steiner"];
    add(iso(m, 7 + Math.floor(rnd() * 4)), `TWINT Geld senden an ${pick(friends)} +41 79 412 33 18`, -pick([15, 20, 25, 32.5, 40]));
    add(iso(m, 16 + Math.floor(rnd() * 5)), `TWINT Geld senden an ${pick(friends)} +41 76 553 20 87`, -pick([12, 18, 24, 30]));
    add(iso(m, 22 + Math.floor(rnd() * 5)), `TWINT Geld empfangen von ${pick(friends)} +41 78 220 61 09`, pick([20, 25, 45, 60]));

    // --- transport extras ------------------------------------------------------------
    add(iso(m, 13 + Math.floor(rnd() * 3)), "Einkauf SBB Mobile, Ticket Zürich HB - Bern", -between(26, 52));
  }

  // --- one-off & irregular -------------------------------------------------------------
  add("2026-07-03", card("SBB CFF FFS Zürich HB, Halbtax Erneuerung"), -190.0);
  add("2026-08-20", "eBill Serafe AG, Radio- und Fernsehabgabe 2026", -335.0);
  add("2026-09-22", "eBill ewz Elektrizitätswerk der Stadt Zürich, Rechnung Q3", -126.4);
  add("2026-08-31", "E-Banking Auftrag Steueramt Kanton Zürich, Rate Staats- und Gemeindesteuern 2026", -850.0);
  add("2026-09-30", "E-Banking Auftrag Steueramt Kanton Zürich, Rate Staats- und Gemeindesteuern 2026", -850.0);
  add("2026-07-08", card("Galaxus.ch Zürich"), -149.0);
  add("2026-08-27", card("Digitec Galaxus AG Online"), -79.9);
  add("2026-09-11", card("ZALANDO.CH BERLIN"), -118.85);
  add("2026-09-19", "Gutschrift ZALANDO.CH, Rückerstattung", 59.95);
  add("2026-07-21", card("IKEA AG Dietlikon"), -86.4);
  add("2026-07-30", card("Apotheke Bahnhof Zürich"), -32.6);
  add("2026-09-15", card("Bauhaus Zürich-Wollishofen"), -44.1);

  // holiday in Lisbon (booked in July, travel mid-August)
  add("2026-07-14", card("EASYJET ONLINE LUTON"), -238.4);
  add("2026-07-16", card("AIRBNB * HMQ4E2X8 LONDON"), -612.0);
  add("2026-08-14", card("SBB CFF FFS Zürich Flughafen"), -6.8);
  add("2026-08-15", card("HOTEL BAIRRO ALTO LISBOA"), -420.0);
  add("2026-08-16", card("PINGO DOCE LISBOA"), -24.3);
  add("2026-08-17", card("TIME OUT MARKET LISBOA"), -38.6);
  add("2026-08-18", card("PASTEIS DE BELEM LISBOA"), -11.2);
  add("2026-08-19", card("CARRIS METRO LISBOA"), -14.0);
  add("2026-08-19", "Gebühr Fremdwährung Kartentransaktion", -4.85);

  // local businesses no rule list knows (exercise the LLM categoriser)
  add("2026-07-05", twint("Bäckerei Hug Luzern"), -14.6);
  add("2026-07-11", twint("Kafi Dihei"), -11.5);
  add("2026-07-25", card("Brockenhaus Zürich"), -36.0);
  add("2026-08-04", card("Velo Lade Wipkingen"), -164.0);
  add("2026-08-09", twint("Kafi Dihei"), -9.8);
  add("2026-08-23", card("Chäsladen Glattpark"), -27.35);
  add("2026-09-02", twint("Buchhandlung Calligramme"), -42.0);
  add("2026-09-06", twint("Blumen Rosenhof Wipkingen"), -24.0);
  add("2026-09-13", card("Atelier Tonwerk Kreis 5"), -95.0);
  add("2026-09-20", twint("Hofladen Gut Rheinau"), -31.4);
  add("2026-09-24", card("Quartierbeiz Zur Lochergut"), -58.5);
  add("2026-09-27", twint("Kiosk am Idaplatz"), -7.2);

  const result = finaliseTransactions(tx, { format: "sample", bank: "Räppli Demo", currency: "CHF" });
  return { ...result, warnings: [] };
}
