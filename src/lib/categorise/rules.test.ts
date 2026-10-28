import { describe, expect, it } from "vitest";
import type { CategoryId, Transaction } from "@/lib/types";
import { RULE_COUNT, RULE_PATTERN_COUNT, categoriseByRules, normaliseText } from "./rules";

function tx(description: string, amount = -25, counterparty?: string): Transaction {
  return { id: "t", date: "2025-03-14", description, counterparty, amount, currency: "CHF" };
}

type Case = [text: string, category: CategoryId, merchant?: string, amount?: number, counterparty?: string];

function check(cases: Case[]) {
  it.each(cases)("%s -> %s", (text, category, merchant, amount, counterparty) => {
    const hit = categoriseByRules(tx(text, amount ?? -25, counterparty));
    expect(hit?.category).toBe(category);
    if (merchant !== undefined) expect(hit?.merchant).toBe(merchant);
  });
}

describe("normaliseText", () => {
  it("folds umlauts, accents and ae/oe/ue spellings", () => {
    expect(normaliseText("ZÜRICH")).toBe("zurich");
    expect(normaliseText("ZUERICH")).toBe("zurich");
    expect(normaliseText("Genève")).toBe("geneve");
    expect(normaliseText("Bäckerei Müller")).toBe(normaliseText("BAECKEREI MUELLER"));
    expect(normaliseText("McDonald's")).toBe("mcdonalds");
    expect(normaliseText("H&M")).toBe("h and m");
    expect(normaliseText("Sprüngli")).toBe(normaliseText("Spruengli"));
  });
});

describe("dictionary size", () => {
  it("has 300+ patterns", () => {
    expect(RULE_PATTERN_COUNT).toBeGreaterThanOrEqual(300);
    expect(RULE_COUNT).toBeGreaterThan(150);
  });
});

describe("groceries", () => {
  check([
    ["Einkauf ZKB Maestro Karte Nr. 1234 MIGROS M ZUERICH HB", "groceries", "Migros"],
    ["Paiement carte COOP-1234 LAUSANNE", "groceries", "Coop"],
    ["Acquisto carta Debit COOP PRONTO LUGANO", "groceries", "Coop Pronto"],
    ["Migrolino Zürich", "groceries", "Migrolino"],
    ["DENNER 5214 BERN", "groceries", "Denner"],
    ["ALDI SUISSE 123 WINTERTHUR", "groceries", "Aldi Suisse"],
    ["LIDL SCHWEIZ 4412", "groceries", "Lidl"],
    ["VOLG LAENGENBACH", "groceries", "Volg"],
    ["Kartenzahlung SPAR EXPRESS BASEL", "groceries", "Spar"],
    ["Landi Reba AG", "groceries", "Landi"],
    ["AVEC BOX Zürich HB", "groceries", "Avec"],
    ["K KIOSK 8001 Zürich", "groceries", "K Kiosk"],
    ["Migros Online Bestellung", "groceries", "Migros Online"],
    ["LeShop.ch", "groceries"],
    ["Too Good To Go", "groceries", "Too Good To Go"],
    ["Bäckerei Hug Thun", "groceries"],
    ["Boulangerie du Marché Fribourg", "groceries"],
    ["METZGEREI ZUMSTEIN", "groceries"],
    ["Hofladen Meier Wohlen", "groceries"],
    ["COOP4711 Bern Bahnhof", "groceries", "Coop"],
  ]);

  it("does not let short names match inside longer words", () => {
    expect(categoriseByRules(tx("Cooperative Bank Gebuehren Q1"))?.category).not.toBe("groceries");
    expect(categoriseByRules(tx("Sparkonto Zinsen"))?.category).not.toBe("groceries");
    expect(categoriseByRules(tx("Paiement avec carte Visa"))).toBeNull();
    expect(categoriseByRules(tx("Zahlung über CHF 120.00"))).toBeNull();
  });
});

describe("restaurants", () => {
  check([
    ["UBER *EATS", "restaurants", "Uber Eats"],
    ["McDonald's Zürich HB", "restaurants", "McDonald's"],
    ["MCDONALDS 1234", "restaurants", "McDonald's"],
    ["Starbucks Coffee Basel", "restaurants", "Starbucks"],
    ["Hiltl AG Zürich", "restaurants", "Hiltl"],
    ["tibits Bern", "restaurants", "Tibits"],
    ["Just Eat Takeaway", "restaurants", "Just Eat"],
    ["Confiserie Sprüngli Paradeplatz", "restaurants", "Sprüngli"],
    ["Brezelkoenig Bern", "restaurants", "Brezelkönig"],
    ["Restaurant Rössli Luzern", "restaurants"],
    ["Ristorante Da Mario Lugano", "restaurants"],
    ["Pizzeria Napoli Biel", "restaurants"],
    ["Café Central", "restaurants"],
    ["Bar Rossi", "restaurants"],
    ["Brasserie Lipp Genève", "restaurants"],
    ["Sushi Yama Zürich", "restaurants"],
    ["Take Away Kebab Haus", "restaurants"],
  ]);

  it("keeps cash payments in bar out of restaurants", () => {
    expect(categoriseByRules(tx("Zahlung in bar"))?.category).not.toBe("restaurants");
    expect(categoriseByRules(tx("Bar Einzahlung Schalter"))?.category).not.toBe("restaurants");
  });
});

describe("transport", () => {
  check([
    ["TWINT *SBB CFF FFS", "transport", "SBB"],
    ["SBB Mobile Ticket", "transport", "SBB"],
    ["UBER *TRIP help.uber.com", "transport", "Uber"],
    ["UBER   *TRIP", "transport", "Uber"],
    ["ZVV Billettautomat", "transport", "ZVV"],
    ["Bernmobil Abo", "transport", "Bernmobil"],
    ["VBZ Zürich Ticket", "transport", "VBZ"],
    ["TPG Genève billet", "transport", "TPG"],
    ["PostAuto Schweiz AG", "transport", "PostAuto"],
    ["CarPostal Suisse", "transport", "PostAuto"],
    ["Mobility Genossenschaft", "transport", "Mobility"],
    ["PubliBike", "transport", "PubliBike"],
    ["Taxi 444 Zürich", "transport"],
    ["BLS AG Spiez", "transport", "BLS"],
    ["Halbtax Abo SBB", "transport"],
  ]);

  it("does not read the German word 'über' as Uber", () => {
    expect(categoriseByRules(tx("Dauerauftrag über CHF 300.00"))).toBeNull();
  });
});

describe("car", () => {
  check([
    ["Shell Select Winterthur", "car", "Shell"],
    ["AVIA Tankstelle Baar", "car", "Avia"],
    ["Agrola Tankstelle", "car", "Agrola"],
    ["MIGROL SERVICE 0815", "car", "Migrol"],
    ["Coop Pronto Tankstelle Aarau", "car", "Coop Pronto Tankstelle"],
    ["TCS Mitglied Beitrag", "car", "TCS"],
    ["Parkhaus Bahnhof Bern", "car"],
    ["PARKINGPAY Zürich", "car", "ParkingPay"],
    ["EasyPark Parking", "car", "EasyPark"],
    ["Strassenverkehrsamt Kanton Zürich", "car"],
    ["Autobahnvignette 2025", "car"],
    ["AMAG Automobil und Motoren AG", "car", "AMAG"],
    ["Garage Müller AG Service", "car"],
    ["Waschanlage Selecta", "car"],
  ]);
});

describe("housing, utilities, telecom", () => {
  check([
    ["Dauerauftrag Miete April", "housing"],
    ["Mietzins Wohnung Bahnhofstrasse", "housing"],
    ["Loyer mars 2025", "housing"],
    ["Affitto appartamento", "housing"],
    ["Livit AG Immobilien-Bewirtschaftung", "housing", "Livit"],
    ["Hypothekarzins Q1", "housing"],
    ["Immobilienverwaltung Muster AG", "housing"],
    ["EWZ Stromrechnung", "utilities", "EWZ"],
    ["BKW Energie AG", "utilities", "BKW"],
    ["Romande Energie SA", "utilities", "Romande Energie"],
    ["Services Industriels de Genève facture", "utilities"],
    ["Nebenkosten Akonto", "utilities"],
    ["Swisscom (Schweiz) AG", "telecom", "Swisscom"],
    ["Sunrise Communications AG", "telecom", "Sunrise"],
    ["Salt Mobile SA", "telecom", "Salt"],
    ["Coop Mobile", "telecom", "Coop Mobile"],
    ["Wingo", "telecom", "Wingo"],
    ["Galaxus Mobile", "telecom", "Galaxus Mobile"],
    ["M-Budget Mobile Abo", "telecom", "M-Budget Mobile"],
    ["Swisscom Blue TV", "subscriptions"],
  ]);
});

describe("insurance and health", () => {
  check([
    ["Lastschrift CSS Kranken-Versicherung AG", "insurance", "CSS"],
    ["Helsana Versicherungen AG", "insurance", "Helsana"],
    ["Swica Gesundheitsorganisation", "insurance", "Swica"],
    ["Groupe Mutuel Prime", "insurance", "Groupe Mutuel"],
    ["Mobiliar Versicherung", "insurance", "Mobiliar"],
    ["AXA Versicherungen", "insurance", "AXA"],
    ["Zurich Versicherungs-Gesellschaft AG", "insurance", "Zurich Versicherung"],
    ["Assura-Basis SA", "insurance", "Assura"],
    ["Prämienrechnung Krankenkasse", "insurance"],
    ["Cassa malati premio", "insurance"],
    ["TCS Rechtsschutz Versicherung", "insurance", "TCS Versicherung"],
    ["Amavita Apotheke Bern", "health", "Amavita"],
    ["Sun Store Luzern", "health", "Sun Store"],
    ["Coop Vitality Zürich", "health", "Coop Vitality"],
    ["Apotheke am Bahnhof", "health"],
    ["Pharmacie Principale Sion", "health"],
    ["Dr. med. Meier Praxis", "health"],
    ["Zahnarztpraxis Dr. Keller", "health"],
    ["Kantonsspital Aarau", "health"],
    ["Fielmann AG", "health", "Fielmann"],
    ["Physiotherapie Zentrum", "health"],
  ]);

  it("leaves vets to the LLM instead of calling them doctors", () => {
    expect(categoriseByRules(tx("Tierarzt Praxis Sonnhalde"))?.category).not.toBe("health");
  });
});

describe("shopping", () => {
  check([
    ["Galaxus AG Zürich", "shopping", "Galaxus"],
    ["Digitec Galaxus AG", "shopping", "Galaxus"],
    ["ZALANDO PAYMENTS GMBH", "shopping", "Zalando"],
    ["H&M Hennes & Mauritz AG", "shopping", "H&M"],
    ["IKEA Spreitenbach", "shopping", "IKEA"],
    ["Manor AG Basel", "shopping", "Manor"],
    ["Manor Food Zürich", "groceries", "Manor Food"],
    ["Interdiscount Filiale", "shopping", "Interdiscount"],
    ["MediaMarkt Dietikon", "shopping", "MediaMarkt"],
    ["AMAZON EU SARL", "shopping", "Amazon"],
    ["AMZN Mktp DE", "shopping", "Amazon"],
    ["Orell Füssli Thalia", "shopping", "Orell Füssli"],
    ["Do it + Garden Migros", "shopping", "Do it + Garden"],
    ["Coop Bau+Hobby Lenzburg", "shopping", "Coop Bau+Hobby"],
    ["Apple Store Zürich", "shopping", "Apple Store"],
    ["Müller Drogerie Bern", "shopping", "Müller"],
    ["Brockenhaus Winterthur", "shopping"],
  ]);

  it("does not treat a person called Müller as the shop", () => {
    expect(categoriseByRules(tx("Zahlung an Hans Müller"))).toBeNull();
  });
});

describe("leisure and subscriptions", () => {
  check([
    ["Kino Pathé Les Galeries", "leisure", "Pathé"],
    ["Ticketcorner AG", "leisure", "Ticketcorner"],
    ["Activ Fitness Winterthur", "leisure", "Activ Fitness"],
    ["Migros Fitnesspark", "leisure", "Migros Fitnesspark"],
    ["Zermatt Bergbahnen AG", "leisure", "Zermatt Bergbahnen"],
    ["PlayStation Network", "leisure", "PlayStation"],
    ["Nintendo Europe", "leisure", "Nintendo"],
    ["Netflix.com", "subscriptions", "Netflix"],
    ["SPOTIFY P1A2B3", "subscriptions", "Spotify"],
    ["APPLE.COM/BILL Cork", "subscriptions", "Apple"],
    ["Google *YouTube Premium", "subscriptions"],
    ["Amazon Prime Video", "subscriptions", "Amazon Prime"],
    ["DISNEY PLUS", "subscriptions", "Disney+"],
    ["OpenAI *CHATGPT SUBSCR", "subscriptions", "OpenAI"],
    ["NZZ Neue Zürcher Zeitung AG", "subscriptions", "NZZ"],
    ["UBER *ONE", "subscriptions", "Uber One"],
  ]);
});

describe("travel and education and children", () => {
  check([
    ["easyJet Airline Company", "travel", "easyJet"],
    ["SWISS INTERNATIONAL AIR LINES", "travel", "Swiss"],
    ["Booking.com Amsterdam", "travel", "Booking.com"],
    ["AIRBNB * HMXYZ", "travel", "Airbnb"],
    ["Hotelplan Suisse", "travel", "Hotelplan"],
    ["FlixBus Germany", "travel", "FlixBus"],
    ["Hôtel de la Paix Lausanne", "travel"],
    ["Albergo Lugano Centro", "travel"],
    ["ETH Zürich Semestergebühr", "education"],
    ["Universität Bern", "education", "Universität"],
    ["Migros Klubschule", "education", "Klubschule Migros"],
    ["Udemy Inc", "education", "Udemy"],
    ["Sprachkurs Berlitz", "education"],
    ["Kita Kinderland", "children"],
    ["Krippe Wirbelwind", "children"],
    ["Crèche Les Lutins Genève", "children"],
    ["Franz Carl Weber Zürich", "children", "Franz Carl Weber"],
  ]);

  it("does not mistake exchange rates for courses", () => {
    expect(categoriseByRules(tx("Kurs 1.0923 EUR"))?.category).not.toBe("education");
    expect(categoriseByRules(tx("Devisenkurs"))?.category).not.toBe("education");
  });
});

describe("taxes, fees, cash, savings, transfers", () => {
  check([
    ["Steueramt Kanton Zürich", "taxes"],
    ["Kantonale Steuerverwaltung Bern", "taxes"],
    ["Administration fiscale cantonale", "taxes"],
    ["Amministrazione delle contribuzioni", "taxes"],
    ["Serafe AG", "taxes", "Serafe"],
    ["Ordnungsbusse Stadtpolizei", "taxes"],
    ["Kontoführungsgebühr Q1", "fees"],
    ["Kontofuehrung Privatkonto", "fees"],
    ["Bargeldbezugsgebühr", "fees"],
    ["Jahresgebühr Karte", "fees"],
    ["Fremdwährungsgebühr", "fees"],
    ["Frais de tenue de compte", "fees"],
    ["Spese di gestione conto", "fees"],
    ["Migros Bank Kontoführung Gebühr", "fees"],
    ["Bancomat Bezug", "cash"],
    ["Geldautomat Bezug Bahnhof", "cash"],
    ["Retrait Bancomat Lausanne", "cash"],
    ["Prelievo Postomat", "cash"],
    ["Bargeldbezug ATM", "cash"],
    ["Dauerauftrag Säule 3a", "savings"],
    ["Pilier 3a VIAC", "savings", "VIAC"],
    ["Pilastro 3a", "savings"],
    ["frankly Vorsorge ZKB", "savings", "frankly"],
    ["finpension AG", "savings", "finpension"],
    ["Swissquote Bank Einzahlung", "savings", "Swissquote"],
    ["Übertrag auf Sparkonto", "savings"],
    ["Übertrag auf Konto 4711", "transfers"],
    ["Kontoübertrag eigenes Konto", "transfers"],
    ["Virement interne", "transfers"],
    ["Trasferimento tra conti", "transfers"],
    ["Revolut Top-up", "transfers"],
    ["TWINT an Hans Muster", "transfers"],
    ["TWINT Geld senden an Anna Meier", "transfers"],
    ["Twint von Max Frei", "transfers", undefined, 50],
  ]);

  it("leaves Migros Bank without context to the LLM and never calls it groceries", () => {
    expect(categoriseByRules(tx("Migros Bank AG"))).toBeNull();
  });

  it("keeps TWINT merchant payments in their merchant category", () => {
    expect(categoriseByRules(tx("TWINT an Coop Pronto"))?.category).toBe("groceries");
    expect(categoriseByRules(tx("TWINT an Restaurant Rössli"))?.category).toBe("restaurants");
  });
});

describe("income and refunds", () => {
  check([
    ["Gutschrift Lohn Muster AG", "income", undefined, 5400],
    ["Salär Mai", "income", undefined, 6100],
    ["Salaire mars", "income", undefined, 5200],
    ["Stipendio aprile", "income", undefined, 4800],
    ["Salary payment ACME", "income", undefined, 7000],
    ["Gehaltszahlung", "income", undefined, 4000],
    ["Ausgleichskasse AHV Rente", "income", undefined, 2100],
    ["IV-Rente Januar", "income", undefined, 1800],
    ["ALV Taggeld", "income", undefined, 3000],
    ["Lohn Migros Genossenschaft", "income", undefined, 5000],
    ["Rückerstattung Zalando", "shopping", "Zalando", 59.9],
    ["Gutschrift Migros", "groceries", "Migros", 12.5],
    ["Rückzahlung CSS Versicherung", "insurance", "CSS", 300],
  ]);

  it("returns null for unknown incoming payments", () => {
    expect(categoriseByRules(tx("Zahlung von Hans Muster", 150))).toBeNull();
    expect(categoriseByRules(tx("Restaurant Gutschrift", 20))).toBeNull();
  });

  it("does not treat outgoing Lohn as income", () => {
    expect(categoriseByRules(tx("Lohn Mitarbeiter", -4000))).toBeNull();
  });

  it("returns null for unknown outgoing payments", () => {
    expect(categoriseByRules(tx("Zahlung Max Mustermann Rechnung 4711"))).toBeNull();
  });
});

describe("matching source", () => {
  it("prefers the counterparty and falls back to the description", () => {
    expect(categoriseByRules(tx("Karte 1234 12.03.", -10, "Migros"))?.merchant).toBe("Migros");
    expect(categoriseByRules(tx("Karte 1234 COOP ZUERICH", -10, "Muster Hans"))?.merchant).toBe("Coop");
  });

  it("never matches bare city names", () => {
    expect(categoriseByRules(tx("Zürich"))).toBeNull();
    expect(categoriseByRules(tx("Zahlung Basel"))).toBeNull();
    expect(categoriseByRules(tx("Genève"))).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(categoriseByRules(tx(""))).toBeNull();
  });
});
