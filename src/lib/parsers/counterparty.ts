// Derives a clean merchant / counterparty name from raw Swiss booking texts.
// "Einkauf ZKB Maestro Karte Nr. xxxx 1234, MIGROS M ZUERICH HB ZUERICH" → "Migros Zürich HB"

import { normaliseKey } from "./values";

const SWISS_CITIES = [
  "zurich", "zuerich", "zurich flughafen", "zuerich flughafen", "zurich airport",
  "bern", "berne", "basel", "bale", "luzern", "lucerne", "geneve", "genf", "geneva", "lausanne", "winterthur",
  "st gallen", "st gall", "lugano", "biel", "bienne", "biel bienne", "thun", "zug", "baden", "aarau", "chur", "olten",
  "schaffhausen", "fribourg", "freiburg", "neuchatel", "sion", "sitten", "wallisellen", "duebendorf", "dubendorf",
  "kloten", "uster", "waedenswil", "wadenswil", "bellinzona", "locarno", "montreux", "vevey", "nyon", "yverdon",
  "yverdon les bains", "emmen", "kriens", "rapperswil", "rapperswil jona", "frauenfeld", "wil", "dietikon",
  "schlieren", "opfikon", "oerlikon", "zurich oerlikon", "zuerich oerlikon", "altstetten", "wetzikon", "horgen",
  "thalwil", "kuesnacht", "kusnacht", "meilen", "zollikon", "adliswil", "regensdorf", "buelach", "bulach",
  "glattbrugg", "solothurn", "burgdorf", "langenthal", "liestal", "allschwil", "riehen", "muttenz", "pratteln",
  "davos", "st moritz", "interlaken", "grindelwald", "zermatt", "brig", "visp", "martigny", "monthey", "delemont",
  "la chaux de fonds", "carouge", "meyrin", "vernier", "lancy", "renens", "morges", "pully", "wohlen",
  "spreitenbach", "oftringen", "zofingen", "lenzburg", "brugg", "wettingen", "volketswil", "pfaeffikon",
  "pfaffikon", "wollerau", "einsiedeln", "schwyz", "altdorf", "sarnen", "stans", "glarus", "herisau", "appenzell",
  "kreuzlingen", "arbon", "romanshorn", "mendrisio", "chiasso", "ascona",
];
const FOREIGN_CITIES = [
  "london", "luton", "dublin", "amsterdam", "luxembourg", "berlin", "paris", "milano", "milan", "muenchen", "munchen",
  "munich", "wien", "vienna", "barcelona", "madrid", "lisboa", "lisbon", "roma", "rome", "stockholm", "cork",
  "los gatos", "san francisco", "seattle", "konstanz", "lorrach", "loerrach", "como", "porto",
];
const FOREIGN_SET = new Set(FOREIGN_CITIES);
const CITY_SET = new Set([...SWISS_CITIES, ...FOREIGN_CITIES]);

const COUNTRY_SUFFIX = /\s+(?:CH|CHE|DE|DEU|FR|FRA|IT|ITA|AT|AUT|GB|GBR|IE|IRL|NL|NLD|LU|LUX|US|USA|ES|ESP|PT|PRT|SE|SWE)$/;

const UPPER_WORDS = new Set([
  "SBB", "CFF", "FFS", "ZVV", "EWZ", "VBZ", "BLS", "UBS", "ZKB", "BCV", "BCGE", "CSS", "AXA", "SRF", "TCS", "ATM",
  "AG", "SA", "HB", "USA", "UK", "EU", "BKW", "IWB", "EKZ", "KPT", "OKK", "SWICA", "AMAG", "VIAC", "H&M", "C&A",
  "DM", "BP", "TPG", "TL", "SNB", "AHV", "IV", "EO", "BVG", "PK", "MBA", "SIX", "ÖKK", "IKEA", "ABB", "UPC",
  "CH", "TV", "SAC", "VBL", "BVB", "BLT", "RBS", "SOB", "RhB", "ZSG", "PKZ", "OVS", "TK", "EWB",
]);

const SPECIAL_WORDS: Record<string, string> = {
  gmbh: "GmbH",
  zuerich: "Zürich",
  zurich: "Zürich",
  geneve: "Genève",
  neuchatel: "Neuchâtel",
  duebendorf: "Dübendorf",
  waedenswil: "Wädenswil",
  kuesnacht: "Küsnacht",
  baeckerei: "Bäckerei",
  buelach: "Bülach",
  muenchen: "München",
  pfaeffikon: "Pfäffikon",
  delemont: "Delémont",
  loerrach: "Lörrach",
  "mcdonald's": "McDonald's",
  mcdonalds: "McDonald's",
  ebay: "eBay",
  easyjet: "easyJet",
  rhb: "RhB",
  und: "und",
  de: "de",
  la: "la",
  le: "le",
  du: "du",
  des: "des",
  di: "di",
  da: "da",
  von: "von",
  am: "am",
  im: "im",
  et: "et",
  e: "e",
};
const LOWER_ONLY_WHEN_INNER = new Set(["und", "de", "la", "le", "du", "des", "di", "da", "von", "am", "im", "et", "e"]);

// Prefixes removed (repeatedly) from the start of a segment.
const PREFIXES: RegExp[] = [
  /^(?:einkauf|kauf\/dienstleistung|kauf|achat|acquisto|purchase|bezug)\b(?:\s+(?:zkb|ubs|pf|postfinance|raiffeisen|migros bank))?(?:\s+(?:maestro|visa\s+debit|visa|debit\s+mastercard|mastercard|v\s*pay|debitkarte|debit\s+card|karte|card|carte|carta|di\s+debito|de\s+d[ée]bit|twint|online))*\s*(?:vom|du|del|am)?\s*/i,
  /^(?:debitkarten-?belastung|debitkarten-?zahlung|zahlung\s+(?:mit\s+)?debitkarte|debitkarte|kartenzahlung|kartentransaktion|karten-?einkauf|paiement\s+(?:par\s+)?carte(?:\s+de\s+d[ée]bit)?|achat\s+(?:par\s+)?carte|pagamento\s+(?:con\s+)?carta(?:\s+di\s+debito)?|acquisto\s+(?:con\s+)?carta|card\s+payment|card\s+transaction|pos\s+purchase|pos)\b[:\s]*(?:vom|du|del|am)?\s*/i,
  /^twint\s*(?:\*|kauf\/dienstleistung|kauf|dienstleistung|zahlung|payment|achat|acquisto|pagamento|belastung|gutschrift)?\s*(?:vom|du|del|am)?\s*/i,
  /^(?:geld\s+senden|geld\s+empfangen|send\s+money|receive\s+money|money\s+sent|money\s+received|envoyer\s+de\s+l'argent|recevoir\s+de\s+l'argent|inviare\s+denaro|ricevere\s+denaro)\b\s*(?:an|von|to|from|à|de|a|da)?\s*/i,
  /^(?:e-?banking[-\s](?:auftrag|vergütung|verguetung|zahlung|order)|e-?finance(?:\s+auftrag)?|ordre\s+e-?banking|ordine\s+e-?banking|mobile[-\s]banking(?:\s+auftrag)?|dauerauftrag|ordre\s+permanent|ordine\s+permanente|standing\s+order|zahlungsauftrag|zahlung|überweisung|ueberweisung|vergütung|verguetung|virement|paiement|bonifico|pagamento|payment\s+(?:to|from)|transfer\s+(?:to|from)|gutschrift|crédit|accredito|belastung|lastschrift|lsv\+?|direct\s+debit|d[ée]bit\s+direct|debit\s+direct|giro\s+(?:post|bank|aus\s+konto|international)|esr|qr-?rechnung|auftrag\s+debit\s+direct|auftrag|e-?bill|sammelauftrag)\b[\s:]*(?:von|an|de|à|da|a|to|from|für|pour|per)?\b\s*/i,
  /^(?:to|from|an|von)\s+(?=\S)/i,
  /^(?:paypal|sumup|sq|zettle|iz|tst|ztl|sp|stripe|google|amzn\s+mktp|amazon\s+mktpl?)\s*\*\s*/i,
];

const CUT_MARKERS =
  /\b(?:zahlungsgrund|mitteilung(?:en)?|communication|comunicazione|zahlungszweck|verwendungszweck|purpose|motif|causale|referenz|reference|référence|riferimento|transaktions-?nr|kartennummer)\s*:/i;

function stripNoise(s: string): string {
  return (
    s
      // IBANs
      .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g, " ")
      // amounts with currency
      .replace(/\b(?:CHF|EUR|USD|GBP)\s*-?[\d'’.,]*\d/g, " ")
      .replace(/-?\d[\d'’.,]*\s*(?:CHF|EUR|USD|GBP)\b/g, " ")
      // dates & times
      .replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/g, " ")
      .replace(/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g, " ")
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:uhr|h)?\b/gi, " ")
      // card numbers
      .replace(/\b(?:debit|kredit|credit|prepaid|maestro|visa|mastercard)?[\s-]?(?:karten?|card|carte|carta)[\s-]*(?:nr|no|nummer|number|n°|num)?\.?\s*:?\s*[x*\d][x*\d\s-]{2,}/gi, " ")
      .replace(/(?:^|\s)[x*]{2,}[\sx*-]*\d{0,4}\b/gi, " ")
      .replace(/\b\d{4,6}[x*]{2,}[x*\d]*\b/gi, " ")
      // phone numbers
      .replace(/(?:\+|\b00)\d{2,3}[\s./-]?(?:\(0\)\s?)?\d{2}(?:[\s./-]?\d{2,3}){2,4}\b/g, " ")
      .replace(/\b0\d{2}[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}\b/g, " ")
      // reference numbers
      .replace(/\b(?:ref|referenz|ref\.?\s*nr|trx|transaktions-?nr|beleg-?nr|auftrags?-?nr|nr)\.?\s*:?\s*[A-Z0-9-]*\d[A-Z0-9-]*/gi, " ")
      .replace(/\b(?=[A-Z0-9]*\d{4,})(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8,}\b/g, " ")
      .replace(/\b\d{6,}\b/g, " ")
      // mixed letter/digit codes like "P2F3A1", "HMQ4E2X8"
      .replace(/\b(?=[A-Z0-9]*\d[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function trimPunct(s: string): string {
  return s.replace(/^[\s,.;:*\-–/|#]+|[\s,;:*\-–/|#]+$/g, "").replace(/\s+/g, " ").trim();
}

function isShouting(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  return upper / letters.length > 0.8;
}

function stripTrailingCity(s: string, shouting: boolean): string {
  // ", Zürich" / ", 8001 Zürich" is always a location
  const comma = /,\s*(?:CH-)?(?:\d{4}\s+)?([\p{L} .'-]+)$/u.exec(s);
  if (comma) {
    const before = s.slice(0, comma.index).trim();
    if (before && (CITY_SET.has(normaliseKey(comma[1])) || /\d{4}/.test(comma[0]))) return before;
  }
  // "... 8001 Zürich"
  const postal = /\s(?:CH-)?\d{4}\s+[\p{L} .'-]+$/u.exec(s);
  if (postal && s.slice(0, postal.index).trim()) return s.slice(0, postal.index).trim();
  const tokens = s.split(" ");
  const set = shouting ? CITY_SET : FOREIGN_SET;
  for (let n = Math.min(3, tokens.length - 1); n >= 1; n--) {
    const tail = normaliseKey(tokens.slice(-n).join(" "));
    if (set.has(tail)) return tokens.slice(0, -n).join(" ");
  }
  return s;
}

function titleWord(word: string, index: number): string {
  if (!word) return word;
  const upper = word.toUpperCase();
  const key = word.toLowerCase();
  if (UPPER_WORDS.has(upper)) return upper === "RHB" ? "RhB" : upper;
  if (SPECIAL_WORDS[key] && !(LOWER_ONLY_WHEN_INNER.has(key) && index === 0)) return SPECIAL_WORDS[key];
  if (/\d/.test(word)) return word;
  if (/^[A-Z]{1,2}$/.test(word) && !/[AEIOUY]/.test(word)) return word; // HB, ZH…
  if (word.includes(".") && /\.[a-z]{2,3}$/i.test(word)) {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return word
    .toLowerCase()
    .split(/([-'’&/])/)
    .map((part) => (part.length > 0 && !/[-'’&/]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("")
    .replace(/(['’])S\b/g, "$1s");
}

/** Converts SHOUTING merchant names to Title Case and fixes ASCII umlaut spellings of known words. */
export function prettifyName(s: string, forceTitle?: boolean): string {
  const shouting = forceTitle ?? isShouting(s);
  const words = s.split(" ");
  return words
    .map((w, i) => {
      if (shouting) return titleWord(w, i);
      const special = SPECIAL_WORDS[w.toLowerCase()];
      if (special && /^(zuerich|zurich|geneve|neuchatel|duebendorf|waedenswil|kuesnacht|baeckerei|buelach|muenchen|pfaeffikon)$/i.test(w)) {
        return special;
      }
      return w;
    })
    .join(" ");
}

function cleanSegment(segment: string): string | undefined {
  let s = segment.replace(/\s+/g, " ").trim();
  const cut = CUT_MARKERS.exec(s);
  if (cut) s = s.slice(0, cut.index);
  s = stripNoise(s);
  for (let guard = 0; guard < 6; guard++) {
    const before = s;
    for (const re of PREFIXES) s = trimPunct(s.replace(re, ""));
    s = trimPunct(s.replace(/^(?:vom|du|del|am|von|an|de|à|da)\s+/i, ""));
    if (s === before) break;
  }
  s = trimPunct(s.replace(/\s*\*\s*/g, " "));
  // trailing web domains ("UBER EATS HELP.UBER.COM") when a name precedes them
  s = s.replace(/^(.*\p{L}{2,}.*?)\s+(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|ch|net|org|io|de|eu)(?:\/\S*)?$/iu, "$1");
  // "Name, purpose/location" → keep the name part
  if (s.includes(",")) {
    const parts = s.split(/\s*,\s*/).filter((p) => /\p{L}{2,}/u.test(p));
    if (parts.length) s = parts[0];
  }
  const shouting = isShouting(s);
  // store numbers / formats: "COOP-1234" → "COOP", "MIGROS M" → "MIGROS"
  s = s.replace(/\b(coop(?:\s+pronto)?|migros|migrolino|denner|volg|spar|lidl|aldi(?:\s+suisse)?|manor|landi)[-\s]?\d{2,5}\b/gi, "$1");
  s = s.replace(/\b(migros)\s+M{1,3}\b/gi, "$1");
  s = s.replace(/\b(aldi)\s+suisse\b/gi, "$1");
  s = s.replace(/\b(?:filiale|fil\.|succursale|store)\s*\d*\b/gi, " ");
  s = trimPunct(s);
  if (shouting) s = s.replace(COUNTRY_SUFFIX, "");
  s = trimPunct(stripTrailingCity(s, shouting));
  if (shouting) s = trimPunct(s.replace(COUNTRY_SUFFIX, ""));
  if (!/\p{L}{2,}/u.test(s)) return undefined;
  s = prettifyName(s, shouting);
  if (s.length > 60) s = s.slice(0, 60).replace(/\s+\S*$/, "");
  return s || undefined;
}

/**
 * Best-effort cleaned counterparty for a raw booking text. Multi-part texts (UBS "Beschreibung1; 2; 3")
 * are split on ";" / "|" / " · " and the first segment that yields a name wins.
 */
export function cleanCounterparty(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const segments = String(raw)
    .split(/\s*[;|]\s*|\s+·\s+|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const seg of segments) {
    const cleaned = cleanSegment(seg);
    if (cleaned) return cleaned;
  }
  return undefined;
}
