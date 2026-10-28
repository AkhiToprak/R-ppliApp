// Generic table → transactions pipeline shared by CSV and XLSX.
// Finds the header row among metadata lines, maps columns via de/fr/it/en synonyms,
// handles debit/credit vs signed amount columns, collective bookings with detail rows,
// summary rows and multi-line descriptions.

import { detectBankFromText } from "./banks";
import type { RawTransaction } from "./normalise";
import {
  detectDecimalSeparator,
  looksLikeCurrency,
  normaliseKey,
  parseAmount,
  parseDate,
  type DecimalSeparator,
} from "./values";

type Role =
  | "bookingDate"
  | "transactionDate"
  | "valueDate"
  | "valuta" // ambiguous: value date (de) or currency (it) — resolved by content
  | "description"
  | "counterparty"
  | "debit"
  | "credit"
  | "amount"
  | "subAmount"
  | "currency"
  | "fee"
  | "state"
  | "direction"
  | "ignore";

const DATE_ROLES: readonly Role[] = ["bookingDate", "transactionDate", "valueDate"];

const EXACT: Record<string, Role> = {
  // dates
  datum: "bookingDate",
  buchungsdatum: "bookingDate",
  "buchungs datum": "bookingDate",
  buchung: "bookingDate",
  "booking date": "bookingDate",
  "booked at": "bookingDate",
  "completed date": "bookingDate",
  date: "bookingDate",
  "date comptable": "bookingDate",
  "date de comptabilisation": "bookingDate",
  "date operation": "bookingDate",
  "date de l operation": "bookingDate",
  data: "bookingDate",
  "data contabile": "bookingDate",
  "data di registrazione": "bookingDate",
  "data registrazione": "bookingDate",
  "data operazione": "bookingDate",
  "transaction date": "transactionDate",
  abschlussdatum: "transactionDate",
  "started date": "transactionDate",
  transaktionsdatum: "transactionDate",
  valutadatum: "valueDate",
  "valuta datum": "valueDate",
  "valuta date": "valueDate",
  "value date": "valueDate",
  "date valeur": "valueDate",
  "date de valeur": "valueDate",
  valeur: "valueDate",
  "data valuta": "valueDate",
  valuta: "valuta",
  // description
  buchungstext: "description",
  text: "description",
  texte: "description",
  beschreibung: "description",
  beschreibung1: "description",
  beschreibung2: "description",
  beschreibung3: "description",
  "beschreibung 1": "description",
  "beschreibung 2": "description",
  "beschreibung 3": "description",
  mitteilung: "description",
  mitteilungen: "description",
  details: "description",
  detail: "description",
  description: "description",
  libelle: "description",
  "libelle de l operation": "description",
  descrizione: "description",
  avviso: "description",
  avisierungstext: "description",
  zahlungszweck: "description",
  "payment purpose": "description",
  verwendungszweck: "description",
  communication: "description",
  motif: "description",
  dettagli: "description",
  causale: "description",
  transaktionen: "description",
  transaktion: "description",
  "activity name": "description",
  subject: "description",
  reference: "description",
  // counterparty
  empfanger: "counterparty",
  zahlungsempfanger: "counterparty",
  auftraggeber: "counterparty",
  "auftraggeber empfanger": "counterparty",
  begunstigter: "counterparty",
  counterparty: "counterparty",
  payee: "counterparty",
  merchant: "counterparty",
  handler: "counterparty",
  beneficiary: "counterparty",
  beneficiaire: "counterparty",
  beneficiario: "counterparty",
  recipient: "counterparty",
  sender: "counterparty",
  name: "counterparty",
  gegenpartei: "counterparty",
  contrepartie: "counterparty",
  controparte: "counterparty",
  ordinante: "counterparty",
  // amounts
  belastung: "debit",
  belastungen: "debit",
  lastschrift: "debit",
  debit: "debit",
  debits: "debit",
  soll: "debit",
  addebito: "debit",
  addebiti: "debit",
  "money out": "debit",
  "paid out": "debit",
  ausgang: "debit",
  gutschrift: "credit",
  gutschriften: "credit",
  credit: "credit",
  credits: "credit",
  haben: "credit",
  accredito: "credit",
  accrediti: "credit",
  "money in": "credit",
  "paid in": "credit",
  eingang: "credit",
  betrag: "amount",
  amount: "amount",
  montant: "amount",
  importo: "amount",
  "credit debit amount": "amount",
  "debit credit amount": "amount",
  umsatz: "amount",
  nettobetrag: "amount",
  "net amount": "amount",
  "transaction amount": "amount",
  einzelbetrag: "subAmount",
  "betrag detail": "subAmount",
  "amount details": "subAmount",
  "amount detail": "subAmount",
  // currency
  wahrung: "currency",
  whrg: "currency",
  whg: "currency",
  whr: "currency",
  currency: "currency",
  curr: "currency",
  ccy: "currency",
  monnaie: "currency",
  devise: "currency",
  divisa: "currency",
  "debit currency": "currency",
  "credit currency": "currency",
  // misc
  fee: "fee",
  fees: "fee",
  state: "state",
  status: "state",
  "soll haben": "direction",
  "debit credit": "direction",
  "dr cr": "direction",
  "cr dr": "direction",
  sens: "direction",
  "s h": "direction",
  "d c": "direction",
  cdtdbtind: "direction",
  saldo: "ignore",
  balance: "ignore",
  solde: "ignore",
  kontostand: "ignore",
  "original amount": "ignore",
  "original currency": "ignore",
  "exchange rate": "ignore",
  abschlusszeit: "ignore",
  fussnoten: "ignore",
  kategorie: "ignore",
  category: "ignore",
  label: "ignore",
  tags: "ignore",
  type: "ignore",
  product: "ignore",
  iban: "ignore",
  bewertungsdatum: "ignore",
  "datum von": "ignore",
  "datum bis": "ignore",
  von: "ignore",
  bis: "ignore",
  bankbeziehung: "ignore",
  portfolio: "ignore",
  produkt: "ignore",
  abschluss: "transactionDate",
  "transaktions nr": "ignore",
  "zkb referenz": "ignore",
  "zkb reference": "ignore",
  referenznummer: "ignore",
  "reference number": "ignore",
};

const CONTAINS: [RegExp, Role][] = [
  [/\b(saldo|balance|solde|kontostand)\b/, "ignore"],
  [/(einzelbetrag|betrag detail|\bamount details?\b|montant detail|importo dettaglio)/, "subAmount"],
  [/\b(original|originalbetrag|exchange rate|devisenkurs|kurs|wechselkurs|taux|cambio)\b/, "ignore"],
  [/\b(fees?|gebuhren?|frais|commissioni?|spesen)\b/, "fee"],
  [/(valutadatum|\bvalue date\b|\bdate (de )?valeur\b|\bdata valuta\b|\bvaluta date\b)/, "valueDate"],
  [/(belastung|lastschrift|\bdebit\b|\bsoll\b|addebit|\bmoney out\b|\bpaid out\b|\bwithdrawals?\b|\buscite\b)/, "debit"],
  [/(gutschrift|\bcredit\b|\bhaben\b|accredit|\bmoney in\b|\bpaid in\b|\bdeposits?\b|\bentrate\b)/, "credit"],
  [/(betrag|\bamount\b|\bmontant\b|\bimporto\b)/, "amount"],
  [/(wahrung|\bcurrency\b|\bmonnaie\b|\bdevise\b|\bwhg\b|\bccy\b)/, "currency"],
  [/(buchungsdatum|\bbooking date\b|\bbooked\b|\bdate comptable\b|\bdata contabile\b|abschlussdatum)/, "bookingDate"],
  [/(datum|\bdate\b|\bdata\b)/, "bookingDate"],
  [/(buchungstext|beschreibung|mitteilung|avisierung|\btext\b|\bdetails?\b|\bdescription\b|\blibelle\b|\bdescrizione\b|zweck|\bpurpose\b|\bmotif\b|\bcausale\b)/, "description"],
  [/(empfanger|auftraggeber|\bcounterparty\b|\bpayee\b|\bmerchant\b|\bbeneficiar|\brecipient\b|\bsender\b)/, "counterparty"],
];

function roleFor(header: string): Role | null {
  const key = normaliseKey(header);
  if (!key) return null;
  if (EXACT[key]) return EXACT[key];
  for (const [re, role] of CONTAINS) if (re.test(key)) return role;
  return null;
}

function headerCurrency(header: string): string | undefined {
  const m = /\b(CHF|EUR|USD|GBP)\b/i.exec(header);
  return m ? m[1].toUpperCase() : undefined;
}

interface ColumnMap {
  dates: { idx: number; role: Role }[];
  description: number[];
  counterparty: number[];
  debit: number[];
  credit: number[];
  amount: number[];
  subAmount: number[];
  currency: number[];
  fee: number[];
  state: number[];
  direction: number[];
  valuta: number[];
  /** Currency implied by a header like "Belastung CHF". */
  headerCurrency?: string;
}

function emptyMap(): ColumnMap {
  return {
    dates: [], description: [], counterparty: [], debit: [], credit: [], amount: [], subAmount: [],
    currency: [], fee: [], state: [], direction: [], valuta: [],
  };
}

function mapHeader(row: readonly string[]): ColumnMap {
  const map = emptyMap();
  row.forEach((cell, idx) => {
    const text = cell.trim();
    if (!text || parseDate(text) || parseAmount(text) !== null) return;
    const role = roleFor(text);
    if (!role || role === "ignore") return;
    if ((role === "debit" || role === "credit" || role === "amount") && !map.headerCurrency) {
      map.headerCurrency = headerCurrency(text);
    }
    if (DATE_ROLES.includes(role)) map.dates.push({ idx, role });
    else if (role === "valuta") map.valuta.push(idx);
    else map[role as Exclude<Role, "bookingDate" | "transactionDate" | "valueDate" | "valuta" | "ignore">].push(idx);
  });
  return map;
}

function headerScore(map: ColumnMap): number {
  const hasDate = map.dates.length > 0 || map.valuta.length > 0;
  const hasAmount = map.debit.length + map.credit.length + map.amount.length + map.subAmount.length > 0;
  if (!hasDate || !hasAmount) return 0;
  let score = 2;
  if (map.description.length) score += 1;
  if (map.counterparty.length) score += 0.5;
  if (map.currency.length) score += 0.5;
  if (map.debit.length && map.credit.length) score += 1;
  if (map.dates.length > 1) score += 0.5;
  return score;
}

// ---- bank detection ----------------------------------------------------------

function detectBank(headerKeys: readonly string[], preamble: string): string | undefined {
  const h = new Set(headerKeys);
  const has = (k: string) => h.has(k);
  if (has("avisierungstext")) return "PostFinance";
  if (has("booked at") && (has("credit debit amount") || has("text"))) return "Raiffeisen";
  if (headerKeys.some((k) => k.startsWith("zkb"))) return "ZKB";
  if (has("beschreibung1") || has("bankbeziehung") || (has("abschlussdatum") && has("einzelbetrag"))) return "UBS";
  if (has("started date") && has("completed date")) return "Revolut";
  if (has("original amount") && (has("subject") || has("spaces") || has("wise"))) return "neon";
  if (has("activity name") || has("activity type")) return "Yuh";
  if ((has("auftrag") || has("auftrag #")) && has("isin")) return "Swissquote";
  return detectBankFromText(preamble);
}

// ---- helpers -----------------------------------------------------------------

const SUMMARY_RE =
  /^(?:total|totale|totaux|summe|zwischentotal|sous-total|saldo|saldovortrag|anfangssaldo|schlusssaldo|endsaldo|kontostand|solde|report|übertrag|uebertrag|umsatz(?:total|summe)?|opening balance|closing balance|balance)\b/i;

const SKIP_STATES = /^(reverted|declined|failed|cancel(?:l)?ed|rejected|storniert|abgelehnt|annul|refused)/i;

function cell(row: readonly string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

function firstFilled(row: readonly string[], idxs: readonly number[]): string {
  for (const i of idxs) {
    const v = cell(row, i);
    if (v) return v;
  }
  return "";
}

function directionSign(value: string): 1 | -1 | 0 {
  const v = normaliseKey(value);
  if (/^(s|soll|d|dr|db|dbit|debit|debit[oe]?|belastung|lastschrift|addebito|out)$/.test(v)) return -1;
  if (/^(h|haben|c|cr|crdt|credit[oe]?|gutschrift|accredito|in)$/.test(v)) return 1;
  return 0;
}

export interface TableParseOutput {
  transactions: RawTransaction[];
  bank?: string;
  currency?: string;
  warnings: string[];
  headerFound: boolean;
}

function sampleColumn(rows: readonly (readonly string[])[], idx: number, n = 40): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const v = cell(r, idx);
    if (v) out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

function ratio(values: readonly string[], pred: (v: string) => boolean): number {
  if (values.length === 0) return 0;
  return values.filter(pred).length / values.length;
}

/** Resolve ambiguous / wrongly-guessed columns by looking at their content. */
function refineByContent(map: ColumnMap, data: readonly (readonly string[])[]): void {
  for (const idx of map.valuta) {
    const values = sampleColumn(data, idx);
    if (ratio(values, looksLikeCurrency) > 0.6) map.currency.push(idx);
    else if (ratio(values, (v) => parseDate(v) !== null) > 0.6) map.dates.push({ idx, role: "valueDate" });
  }
  map.valuta = [];
  map.dates = map.dates.filter(({ idx }) => {
    const values = sampleColumn(data, idx);
    return values.length === 0 || ratio(values, (v) => parseDate(v) !== null) >= 0.5;
  });
  const priority: Record<string, number> = { bookingDate: 0, transactionDate: 1, valueDate: 2 };
  map.dates.sort((a, b) => priority[a.role] - priority[b.role] || a.idx - b.idx);
  // constant columns (e.g. UBS "Bewertungsdatum", product name) carry no per-row information
  if (data.length >= 5) {
    const isConstant = (idx: number) => {
      const values = sampleColumn(data, idx, 500);
      return values.length >= 5 && values.every((v) => v === values[0]);
    };
    if (map.dates.length > 1) {
      const varying = map.dates.filter(({ idx }) => !isConstant(idx));
      if (varying.length) map.dates = varying;
    }
    if (map.description.length > 1) {
      const varying = map.description.filter((idx) => !isConstant(idx));
      if (varying.length) map.description = varying;
    }
  }
  map.currency = map.currency.filter((idx) => {
    const values = sampleColumn(data, idx);
    return values.length === 0 || ratio(values, looksLikeCurrency) >= 0.5;
  });
}

/** When no header row exists, guess columns from content. */
function inferColumns(rows: readonly (readonly string[])[]): { map: ColumnMap; start: number } | null {
  const candidates = rows.filter((r) => r.filter((c) => c.trim()).length >= 3);
  if (candidates.length < 2) return null;
  const width = Math.max(...candidates.map((r) => r.length));
  const map = emptyMap();
  const amountCols: number[] = [];
  let bestText = -1;
  let bestTextLen = 0;
  for (let i = 0; i < width; i++) {
    const values = sampleColumn(candidates, i, 60);
    if (values.length < candidates.length * 0.3) continue;
    if (ratio(values, (v) => parseDate(v) !== null) > 0.8) {
      map.dates.push({ idx: i, role: map.dates.length ? "valueDate" : "bookingDate" });
    } else if (ratio(values, (v) => parseAmount(v) !== null) > 0.8) {
      amountCols.push(i);
    } else if (ratio(values, looksLikeCurrency) > 0.8) {
      map.currency.push(i);
    } else {
      const avg = values.reduce((s, v) => s + v.length, 0) / values.length;
      if (avg > bestTextLen) {
        bestTextLen = avg;
        bestText = i;
      }
    }
  }
  if (!map.dates.length || !amountCols.length) return null;
  if (bestText >= 0) map.description.push(bestText);
  // debit/credit pair: in most rows exactly one of two adjacent amount columns is filled
  for (let k = 0; k + 1 < amountCols.length; k++) {
    const [a, b] = [amountCols[k], amountCols[k + 1]];
    const exclusive = candidates.filter((r) => !!cell(r, a) !== !!cell(r, b)).length;
    if (exclusive / candidates.length > 0.8) {
      map.debit.push(a);
      map.credit.push(b);
      return { map, start: 0 };
    }
  }
  map.amount.push(amountCols[0]);
  return { map, start: 0 };
}

interface Group {
  main: RawTransaction;
  subs: RawTransaction[];
}

/**
 * Parses a 2-D table of strings (CSV rows or spreadsheet rows) into raw transactions.
 */
export function parseTable(input: readonly (readonly unknown[])[]): TableParseOutput {
  const rows: string[][] = input.map((r) => r.map((c) => (c == null ? "" : String(c)).replace(/^="(.*)"$/, "$1").trim()));
  const warnings: string[] = [];

  // 1. header detection
  let headerIdx = -1;
  let best = 0;
  let map = emptyMap();
  const scan = Math.min(rows.length, 60);
  for (let i = 0; i < scan; i++) {
    const m = mapHeader(rows[i]);
    const s = headerScore(m);
    if (s > best) {
      best = s;
      headerIdx = i;
      map = m;
    }
  }
  let dataStart: number;
  let headerFound = true;
  if (headerIdx < 0) {
    const inferred = inferColumns(rows);
    if (!inferred) {
      return { transactions: [], warnings: ["No header row with date and amount columns was found."], headerFound: false };
    }
    map = inferred.map;
    dataStart = inferred.start;
    headerFound = false;
    warnings.push("No header row found; columns were inferred from their content.");
  } else {
    dataStart = headerIdx + 1;
  }

  const headerKeys = headerIdx >= 0 ? rows[headerIdx].map(normaliseKey) : [];
  const preamble = rows
    .slice(0, Math.max(headerIdx, 0))
    .map((r) => r.join(" "))
    .join("\n");
  const data = rows.slice(dataStart);
  refineByContent(map, data);
  if (map.dates.length === 0) {
    return { transactions: [], warnings: [...warnings, "No usable date column was found."], headerFound };
  }
  const bank = detectBank(headerKeys, preamble);

  // statement currency from preamble (e.g. "Bewertet in:;CHF", "Währung:;CHF")
  let statementCurrency = map.headerCurrency;
  if (!statementCurrency) {
    const m = /\b(?:w(?:ä|ae|a)hrung|bewertet in|currency|monnaie|devise|valuta)\b[^A-Za-z]*\b([A-Z]{3})\b/i.exec(preamble);
    if (m && looksLikeCurrency(m[1])) statementCurrency = m[1];
  }

  const amountCols = [...map.debit, ...map.credit, ...map.amount, ...map.subAmount, ...map.fee];
  const decimals = new Map<number, DecimalSeparator | undefined>();
  for (const idx of amountCols) decimals.set(idx, detectDecimalSeparator(sampleColumn(data, idx, 200)));
  const num = (row: readonly string[], idx: number): number | null => parseAmount(cell(row, idx), decimals.get(idx));
  const descOnly = new Set([...map.description, ...map.counterparty]);

  const out: RawTransaction[] = [];
  let group: Group | null = null;
  let last: RawTransaction | null = null;
  let skippedSummary = 0;
  let skippedState = 0;
  let skippedZero = 0;

  const flush = () => {
    if (!group) return;
    const { main, subs } = group;
    if (subs.length > 0) {
      const sumAbs = subs.reduce((s, t) => s + Math.abs(t.amount), 0);
      if (Math.abs(sumAbs - Math.abs(main.amount)) < 0.05) {
        const sign = main.amount < 0 ? -1 : 1;
        for (const s of subs) out.push({ ...s, amount: sign * Math.abs(s.amount) });
      } else {
        warnings.push(
          `Collective booking on ${main.date} (${main.amount.toFixed(2)}): detail rows did not add up, kept the total.`,
        );
        out.push(main);
      }
    } else {
      out.push(main);
    }
    group = null;
  };

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const lineNo = dataStart + r + 1;
    if (row.every((c) => !c)) {
      flush();
      last = null;
      continue;
    }
    // a repeated header line (multi-page exports)
    if (headerIdx >= 0 && row.join("|") === rows[headerIdx].join("|")) continue;

    const descParts: string[] = [];
    for (const idx of map.description) {
      const v = cell(row, idx);
      if (v && !descParts.includes(v)) descParts.push(v);
    }
    const counterparty = firstFilled(row, map.counterparty);
    if (counterparty && !descParts.some((p) => p.includes(counterparty))) descParts.unshift(counterparty);
    const description = descParts.join("; ");

    let date: string | null = null;
    for (const { idx } of map.dates) {
      date = parseDate(cell(row, idx));
      if (date) break;
    }

    const state = firstFilled(row, map.state);
    if (state && SKIP_STATES.test(state)) {
      skippedState++;
      continue;
    }

    let amount: number | null = null;
    const debitRaw = firstFilled(row, map.debit);
    const creditRaw = firstFilled(row, map.credit);
    const amountRaw = firstFilled(row, map.amount);
    if (debitRaw) {
      const v = parseAmount(debitRaw, decimals.get(map.debit.find((i) => cell(row, i)) ?? -1));
      if (v !== null && v !== 0) amount = -Math.abs(v);
    }
    if (amount === null && creditRaw) {
      const v = parseAmount(creditRaw, decimals.get(map.credit.find((i) => cell(row, i)) ?? -1));
      if (v !== null && v !== 0) amount = Math.abs(v);
    }
    if (amount === null && amountRaw) {
      const v = parseAmount(amountRaw, decimals.get(map.amount.find((i) => cell(row, i)) ?? -1));
      if (v !== null) {
        amount = v;
        const dir = directionSign(firstFilled(row, map.direction));
        if (dir !== 0) amount = dir * Math.abs(v);
      }
    }
    if (amount !== null && map.fee.length && bank === "Revolut") {
      const fee = num(row, map.fee[0]);
      if (fee) amount -= Math.abs(fee);
    }
    const subRaw = firstFilled(row, map.subAmount);
    const sub = subRaw ? parseAmount(subRaw, decimals.get(map.subAmount[0])) : null;
    const rowCurrency = firstFilled(row, map.currency).toUpperCase();
    const currency = looksLikeCurrency(rowCurrency) ? rowCurrency : statementCurrency;

    if (amount === null) {
      if (sub !== null && sub !== 0) {
        const g = group as Group | null;
        if (g) {
          g.subs.push({ date: date ?? g.main.date, description: description || g.main.description, amount: sub, currency: currency ?? g.main.currency });
        } else if (date) {
          out.push({ date, description, amount: sub, currency });
          warnings.push(`Row ${lineNo}: detail amount without a total booking, imported as is.`);
        }
        continue;
      }
      const onlyText = row.every((c, i) => !c || descOnly.has(i));
      if (!date && onlyText && last && description) {
        last.description = `${last.description}; ${description}`;
        continue;
      }
      const amountText = debitRaw || creditRaw || amountRaw;
      if (SUMMARY_RE.test(description) || SUMMARY_RE.test(row.find((c) => c) ?? "")) skippedSummary++;
      else if (amountText && parseAmount(amountText) === 0) skippedZero++;
      else if (amountText) warnings.push(`Row ${lineNo}: could not read amount "${amountText.slice(0, 30)}", skipped.`);
      else if (date) warnings.push(`Row ${lineNo}: no amount found, skipped.`);
      continue;
    }

    if (amount === 0) {
      skippedZero++;
      continue;
    }
    if (SUMMARY_RE.test(description) || (!date && SUMMARY_RE.test(row.find((c) => c) ?? ""))) {
      skippedSummary++;
      continue;
    }
    if (!date) {
      warnings.push(`Row ${lineNo}: missing or unreadable date, skipped.`);
      continue;
    }

    flush();
    const tx: RawTransaction = { date, description, amount, currency };
    group = { main: tx, subs: [] };
    last = tx;
  }
  flush();

  if (skippedSummary) warnings.push(`Skipped ${skippedSummary} balance/summary row(s).`);
  if (skippedState) warnings.push(`Skipped ${skippedState} declined/reverted transaction(s).`);
  if (skippedZero) warnings.push(`Skipped ${skippedZero} row(s) with a zero amount.`);

  return { transactions: out, bank, currency: statementCurrency, warnings, headerFound };
}
