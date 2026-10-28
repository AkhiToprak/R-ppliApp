import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseStatementData, StatementParseError } from "./index";

const enc = (s: string) => new TextEncoder().encode(s);
const parse = (csv: string, name = "export.csv") => parseStatementData(enc(csv), name);

const UBS = `Kontonummer:;0235 00123456.40M;
IBAN:;CH12 0023 5235 1234 5640 M;
Von:;2026-07-01;
Bis:;2026-07-31;
Anfangssaldo:;1000.00;
Schlusssaldo:;7372.30;
Bewertet in:;CHF;
Anzahl Transaktionen in diesem Zeitraum:;4;

Abschlussdatum;Abschlusszeit;Buchungsdatum;Valutadatum;Währung;Belastung;Gutschrift;Einzelbetrag;Saldo;Transaktions-Nr.;Beschreibung1;Beschreibung2;Beschreibung3;Fussnoten
2026-07-25;;2026-07-25;2026-07-25;CHF;;6800.00;;7372.30;9930273TI1;Alpenblick Software AG;Lohn Juli;Gutschrift, Transaktions-Nr. 9930273TI1;
2026-07-12;;2026-07-12;2026-07-12;CHF;-190.10;;;572.30;9930273TI2;Diverse Debitkarten-Belastungen;;Sammelbuchung;
2026-07-12;;;;CHF;;;-14.60;;;Bäckerei Hug Luzern;6003 Luzern;Kartenzahlung;
2026-07-12;;;;CHF;;;-11.50;;;Kafi Dihei;8037 Zuerich;Kartenzahlung;
2026-07-12;;;;CHF;;;-164.00;;;Velo Lade Wipkingen;8037 Zuerich;Kartenzahlung;
2026-07-03;;2026-07-03;2026-07-03;CHF;-45.30;;;762.40;9930273TI3;Migros Zuerich HB;8001 Zuerich;Kartenzahlung Debitkarte, Transaktions-Nr. 9930273TI3;
2026-07-01;;2026-07-01;2026-07-01;CHF;-192.30;;;807.70;9930273TI4;Immo Limmat AG;Dauerauftrag;Miete Parkplatz;
`;

const POSTFINANCE = `Datum von:;01.07.2026
Datum bis:;31.07.2026
Buchungsart:;Alle Buchungen
Konto:;CH1209000000123456789
Währung:;CHF

Buchungsdatum;Avisierungstext;Gutschrift in CHF;Lastschrift in CHF;Label;Kategorie
31.07.2026;"KAUF/DIENSTLEISTUNG VOM 30.07.2026 KARTEN NR. XXXX1234 COOP-1832 ZUERICH";;-45.30;;Lebensmittel
25.07.2026;"GUTSCHRIFT VON ALPENBLICK SOFTWARE AG LOHN JULI";6800.00;;;
03.07.2026;"TWINT KAUF/DIENSTLEISTUNG VOM 02.07.2026 KAFI DIHEI";;-11.50;;
01.07.2026;"GIRO POST IMMO LIMMAT AG MIETE JULI";;-2'150.00;;

Disclaimer:
Dies ist kein durch PostFinance AG erstelltes Dokument. PostFinance AG ist nicht verantwortlich für den Inhalt.
`;

const REVOLUT = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-07-02 12:01:44,2026-07-03 09:12:10,Migros,-23.45,0.00,CHF,COMPLETED,476.55
TOPUP,Current,2026-07-01 08:00:00,2026-07-01 08:00:02,Top-Up by *1234,500.00,0.00,CHF,COMPLETED,500.00
CARD_PAYMENT,Current,2026-07-05 19:30:00,2026-07-06 10:00:00,"Uber Eats, Zurich",-31.20,0.00,CHF,COMPLETED,445.35
CARD_PAYMENT,Current,2026-07-07 10:00:00,,Amazon,-15.00,0.00,CHF,DECLINED,445.35
EXCHANGE,Current,2026-07-08 10:00:00,2026-07-08 10:00:01,Exchanged to EUR,-100.00,0.50,CHF,COMPLETED,344.85
`;

const BCGE_FR = `Banque Cantonale de Genève
Relevé de compte;CH12 0078 8000 1234 5678 9
Monnaie;CHF

Date comptable;Libellé;Débit;Crédit;Date valeur;Solde
02.07.2026;Paiement carte MIGROS GENEVE PLAINPALAIS;1 234,50;;02.07.2026;10 000,00
05.07.2026;Virement salaire ACME SA;;5 600,00;05.07.2026;15 600,00
06.07.2026;Paiement carte MANOR GENEVE;45,90;;06.07.2026;15 554,10
Solde au 31.07.2026;;;;;15 554,10
`;

const BANCASTATO_IT = `Data;Descrizione;Addebito;Accredito;Valuta;Saldo
01.07.2026;Pagamento carta COOP-4411 LUGANO;23.40;;01.07.2026;1'000.00
02.07.2026;Accredito stipendio;;4'200.00;02.07.2026;5'176.60
03.07.2026;Ordine e-banking Swisscom;69.90;;03.07.2026;5'106.70
`;

const RAIFFEISEN = `IBAN;Booked At;Text;Credit/Debit Amount;Balance;Valuta Date
CH1580808001234567890;2026-07-01 00:00:00.0;Einkauf Debitkarte Nr. XXXX 9876 Denner Zürich;-18.35;981.65;2026-07-01 00:00:00.0
CH1580808001234567890;2026-07-02 00:00:00.0;Gutschrift Muster AG;250.00;1231.65;2026-07-02 00:00:00.0
CH1580808001234567890;2026-07-03 00:00:00.0;Zahlung Debitkarte Lidl Schweiz;-41.10;1190.55;2026-07-03 00:00:00.0
`;

const ITALIAN_VALUTA_CURRENCY = `Data contabile;Descrizione;Importo;Valuta
01.07.2026;Pagamento carta Migros;-12.50;CHF
02.07.2026;Bonifico Muster SA;300.00;CHF
03.07.2026;Pagamento carta Coop;-7.80;EUR
`;

describe("CSV: UBS", () => {
  it("parses metadata + header, expands collective bookings, detects bank", async () => {
    const res = await parse(UBS);
    expect(res.format).toBe("csv");
    expect(res.bank).toBe("UBS");
    expect(res.currency).toBe("CHF");
    const amounts = res.transactions.map((t) => t.amount);
    expect(amounts).toEqual([-192.3, -45.3, -14.6, -11.5, -164, 6800]);
    expect(res.transactions.map((t) => t.date)).toEqual([
      "2026-07-01", "2026-07-03", "2026-07-12", "2026-07-12", "2026-07-12", "2026-07-25",
    ]);
    // no double counting of the -190.10 collective booking
    expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(6800 - 192.3 - 45.3 - 190.1, 2);
    const hug = res.transactions.find((t) => t.amount === -14.6)!;
    expect(hug.counterparty).toBe("Bäckerei Hug Luzern");
    expect(res.transactions[1].counterparty).toBe("Migros Zürich HB");
    expect(new Set(res.transactions.map((t) => t.id)).size).toBe(res.transactions.length);
  });

  it("keeps the total when detail rows do not add up", async () => {
    const broken = UBS.replace(";-164.00;", ";-100.00;");
    const res = await parse(broken);
    expect(res.transactions.some((t) => t.amount === -190.1)).toBe(true);
    expect(res.transactions.some((t) => t.amount === -100)).toBe(false);
    expect(res.warnings.join(" ")).toMatch(/did not add up/);
  });

  it("produces stable ids", async () => {
    const a = await parse(UBS);
    const b = await parse(UBS);
    expect(a.transactions.map((t) => t.id)).toEqual(b.transactions.map((t) => t.id));
  });

  it("handles the downloadable public sample", async () => {
    const path = fileURLToPath(new URL("../../../public/samples/beispiel-kontoauszug.csv", import.meta.url));
    const res = await parseStatementData(readFileSync(path), "beispiel-kontoauszug.csv");
    expect(res.bank).toBe("UBS");
    expect(res.transactions.length).toBeGreaterThanOrEqual(55);
    expect(res.transactions.length).toBeLessThanOrEqual(70);
    expect(res.transactions[0].date >= "2026-07-01").toBe(true);
    expect(res.transactions.some((t) => t.counterparty === "Kafi Dihei")).toBe(true);
    expect(res.transactions.some((t) => /Diverse/.test(t.description))).toBe(false);
    const salary = res.transactions.filter((t) => t.amount === 6800);
    expect(salary).toHaveLength(3);
    // opening 8432.15 + sum = closing balance in the preamble
    const sum = res.transactions.reduce((s, t) => s + t.amount, 0);
    const closing = /Schlusssaldo:;([\d.]+)/.exec(readFileSync(path, "utf8"))![1];
    expect(8432.15 + sum).toBeCloseTo(Number(closing), 2);
    expect(res.warnings).toEqual([]);
  });
});

describe("CSV: PostFinance", () => {
  it("parses Gutschrift/Lastschrift columns and ignores the disclaimer", async () => {
    const res = await parse(POSTFINANCE);
    expect(res.bank).toBe("PostFinance");
    expect(res.transactions.map((t) => [t.date, t.amount])).toEqual([
      ["2026-07-01", -2150],
      ["2026-07-03", -11.5],
      ["2026-07-25", 6800],
      ["2026-07-31", -45.3],
    ]);
    expect(res.transactions[3].counterparty).toBe("Coop");
    expect(res.transactions[1].counterparty).toBe("Kafi Dihei");
  });

  it("decodes windows-1252 exports", async () => {
    const bytes = Uint8Array.from(Array.from(POSTFINANCE).map((ch) => (ch === "ä" ? 0xe4 : ch === "ü" ? 0xfc : ch.charCodeAt(0))));
    const res = await parseStatementData(bytes, "pf.csv");
    expect(res.transactions).toHaveLength(4);
  });
});

describe("CSV: Revolut (English, comma separated)", () => {
  it("uses completed date, applies fees and skips declined", async () => {
    const res = await parse(REVOLUT);
    expect(res.bank).toBe("Revolut");
    expect(res.transactions.map((t) => [t.date, t.amount])).toEqual([
      ["2026-07-01", 500],
      ["2026-07-03", -23.45],
      ["2026-07-06", -31.2],
      ["2026-07-08", -100.5],
    ]);
    expect(res.transactions[2].description).toBe("Uber Eats, Zurich");
    expect(res.warnings.join(" ")).toMatch(/declined/);
  });
});

describe("CSV: French bank with comma decimals", () => {
  it("parses Débit/Crédit columns with space thousands and skips the balance row", async () => {
    const res = await parse(BCGE_FR);
    expect(res.bank).toBe("BCGE");
    expect(res.transactions.map((t) => t.amount)).toEqual([-1234.5, 5600, -45.9]);
    expect(res.transactions[0].counterparty).toBe("Migros Genève Plainpalais");
    expect(res.transactions[2].counterparty).toBe("Manor");
  });
});

describe("CSV: Italian / Raiffeisen", () => {
  it("treats 'Valuta' as a date when it contains dates (BancaStato)", async () => {
    const res = await parse(BANCASTATO_IT);
    expect(res.transactions.map((t) => t.amount)).toEqual([-23.4, 4200, -69.9]);
    expect(res.transactions[0].counterparty).toBe("Coop");
  });

  it("treats 'Valuta' as currency when it contains currency codes", async () => {
    const res = await parse(ITALIAN_VALUTA_CURRENCY);
    expect(res.transactions.map((t) => t.currency)).toEqual(["CHF", "CHF", "EUR"]);
    expect(res.currency).toBe("CHF");
  });

  it("parses Raiffeisen exports", async () => {
    const res = await parse(RAIFFEISEN);
    expect(res.bank).toBe("Raiffeisen");
    expect(res.transactions.map((t) => t.amount)).toEqual([-18.35, 250, -41.1]);
    expect(res.transactions[0].counterparty).toBe("Denner Zürich");
  });
});

describe("CSV: misc", () => {
  it("parses ZKB exports with detail rows", async () => {
    const zkb = `"Datum";"Buchungstext";"Whg";"Betrag Detail";"ZKB-Referenz";"Referenznummer";"Belastung CHF";"Gutschrift CHF";"Valuta";"Saldo CHF";"Zahlungszweck";"Details"
"02.07.2026";"Einkauf ZKB Visa Debit Karte Nr. xxxx 1234, MIGROS M ZUERICH HB ZUERICH";"";"";"Z123";"";"45.30";"";"02.07.2026";"954.70";"";""
"03.07.2026";"Sammelauftrag E-Banking";"";"";"Z124";"";"300.00";"";"03.07.2026";"654.70";"";""
"";"Swisscom (Schweiz) AG";"CHF";"100.00";"";"";"";"";"";"";"";""
"";"Sunrise GmbH";"CHF";"200.00";"";"";"";"";"";"";"";""
`;
    const res = await parse(zkb);
    expect(res.bank).toBe("ZKB");
    expect(res.transactions.map((t) => [t.date, t.amount, t.counterparty])).toEqual([
      ["2026-07-02", -45.3, "Migros Zürich HB"],
      ["2026-07-03", -100, "Swisscom (Schweiz) AG"],
      ["2026-07-03", -200, "Sunrise GmbH"],
    ]);
  });

  it("detects neon, Yuh and Swissquote exports", async () => {
    const neon = await parse(`"Date";"Amount";"Original amount";"Original currency";"Exchange rate";"Description";"Subject";"Category";"Tags";"Wise";"Spaces"
"2026-07-03";"-12.50";"";"";"";"Migros";"";"groceries";"";"no";"no"
"2026-07-04";"-30.00";"-31.20";"EUR";"0.96";"Lidl Konstanz";"";"groceries";"";"no";"no"
"2026-07-25";"5000.00";"";"";"";"Alpenblick Software AG";"Lohn";"income";"";"no";"no"
`);
    expect(neon.bank).toBe("neon");
    expect(neon.transactions.map((t) => t.amount)).toEqual([-12.5, -30, 5000]);

    const yuh = await parse(`DATE;ACTIVITY TYPE;ACTIVITY NAME;DEBIT;DEBIT CURRENCY;CREDIT;CREDIT CURRENCY;CARD NUMBER;LOCALITY;RECIPIENT;SENDER;FEES/COMMISSION;BUY/SELL;QUANTITY;ASSET;PRICE PER UNIT
03/07/2026;PAYMENT_TRANSACTION_OUT;Migros;12.50;CHF;;;XXXX1234;Zürich;;;;;;;
05/07/2026;BANK_AUTO_ORDER_EXECUTED;Miete;1500.00;CHF;;;;;Immo AG;;;;;;
06/07/2026;PAYMENT_TRANSACTION_IN;Lohn;;;4000.00;CHF;;;;Muster AG;;;;;
`);
    expect(yuh.bank).toBe("Yuh");
    expect(yuh.transactions.map((t) => [t.date, t.amount])).toEqual([
      ["2026-07-03", -12.5],
      ["2026-07-05", -1500],
      ["2026-07-06", 4000],
    ]);

    const sq = await parse(`Datum;Auftrag #;Transaktionen;Symbol;Name;ISIN;Anzahl;Stückpreis;Kosten;Aufgelaufene Zinsen;Nettobetrag;Saldo;Währung
03-07-2026 10:15:22;12345;Zahlung;;;;;;;;-500.00;1000.00;CHF
02-07-2026 09:00:00;12344;Einzahlung;;;;;;;;1500.00;1500.00;CHF
`);
    expect(sq.bank).toBe("Swissquote");
    expect(sq.transactions.map((t) => t.amount)).toEqual([1500, -500]);
  });

  it("infers columns when there is no header", async () => {
    const res = await parse(`01.07.2026;Migros;-12.50\n02.07.2026;Coop;-8.20\n03.07.2026;Lohn;5000.00\n`);
    expect(res.transactions.map((t) => t.amount)).toEqual([-12.5, -8.2, 5000]);
    expect(res.warnings.join(" ")).toMatch(/inferred/);
  });

  it("removes exact duplicates", async () => {
    const res = await parse(`Datum;Text;Betrag\n01.07.2026;Migros;-12.50\n01.07.2026;Migros;-12.50\n02.07.2026;Coop;-3.00\n`);
    expect(res.transactions).toHaveLength(2);
    expect(res.warnings.join(" ")).toMatch(/duplicate/);
  });

  it("throws typed errors", async () => {
    await expect(parseStatementData(new Uint8Array(), "x.csv")).rejects.toMatchObject({ code: "empty" });
    await expect(parse("hello;world\nfoo;bar\n")).rejects.toBeInstanceOf(StatementParseError);
    await expect(parse("hello;world\nfoo;bar\n")).rejects.toMatchObject({ code: "no_transactions" });
    await expect(parseStatementData(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8]), "x.bin")).rejects.toMatchObject({
      code: "unsupported_format",
    });
    await expect(parseStatementData(new Uint8Array(15 * 1024 * 1024 + 1), "big.csv")).rejects.toMatchObject({
      code: "file_too_large",
    });
  });
});
