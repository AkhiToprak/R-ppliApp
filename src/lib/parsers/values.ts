// Low-level value parsing shared by all statement formats.

export type DecimalSeparator = "." | ",";

const THOUSANDS_CHARS = /[\s   '’ʼ´`]/g;

/**
 * Parses Swiss / European / English formatted amounts:
 * 1'234.50 · 1’234.50 · 1 234,50 · 1.234,50 · -1234.50 · 1234.50- · (12.50) · CHF -12.50 · −12.50
 * `decimal` is a column-level hint for ambiguous values like "1,234" or "1.234".
 */
export function parseAmount(input: unknown, decimal?: DecimalSeparator): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/[−‒–—‐]/g, "-");
  // currency codes and symbols
  s = s.replace(/\b(?:[A-Z]{3}|chf|eur|usd|gbp)\b/g, "");
  s = s.replace(/(?:S?Fr\.|[€$£])/g, "").trim();
  // trailing CR/DR markers
  const crdr = /\s*\b(CR|DR|Cr|Dr)\.?$/.exec(s);
  if (crdr) {
    if (crdr[1].toUpperCase() === "DR") negative = !negative;
    s = s.slice(0, crdr.index).trim();
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    s = s.slice(1).trim();
  }
  if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1).trim();
  }
  s = s.replace(THOUSANDS_CHARS, "");
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  if (/^[.,]|[.,]$/.test(s) && !/^[.,]\d+$/.test(s)) {
    // "12." or "12," — tolerate trailing separator
    s = s.replace(/[.,]$/, "");
    if (!s) return null;
  }

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let dec: DecimalSeparator | null;
  if (lastDot >= 0 && lastComma >= 0) {
    dec = lastDot > lastComma ? "." : ",";
  } else if (lastComma >= 0) {
    const count = s.split(",").length - 1;
    const after = s.length - lastComma - 1;
    if (count > 1) dec = null;
    else if (after === 3 && decimal !== ",") dec = null;
    else dec = ",";
  } else if (lastDot >= 0) {
    const count = s.split(".").length - 1;
    const after = s.length - lastDot - 1;
    if (count > 1) dec = null;
    else if (after === 3 && decimal === ",") dec = null;
    else dec = ".";
  } else {
    dec = null;
  }

  const validGroups = (intPart: string): boolean => {
    const seps = intPart.match(/[.,]/g);
    if (!seps) return true;
    if (new Set(seps).size > 1) return false;
    const groups = intPart.split(seps[0]);
    return groups[0].length >= 1 && groups[0].length <= 3 && groups.slice(1).every((g) => g.length === 3);
  };
  let normalised: string;
  if (dec) {
    const idx = s.lastIndexOf(dec);
    const rawInt = s.slice(0, idx);
    const frac = s.slice(idx + 1);
    if (/[.,]/.test(frac) || rawInt.includes(dec) || !validGroups(rawInt)) return null;
    normalised = `${rawInt.replace(/[.,]/g, "") || "0"}.${frac || "0"}`;
  } else {
    if (!validGroups(s)) return null;
    normalised = s.replace(/[.,]/g, "");
  }
  const n = Number(normalised);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return 0;
  return negative ? -n : n;
}

/** Guesses the decimal separator used by a column of amount strings. */
export function detectDecimalSeparator(values: readonly string[]): DecimalSeparator | undefined {
  let comma = 0;
  let dot = 0;
  for (const v of values) {
    const s = v.trim();
    if (/\d,\d{1,2}-?$/.test(s) || /\d\.\d{3},\d/.test(s)) comma++;
    else if (/\d\.\d{1,2}-?$/.test(s) || /\d,\d{3}\.\d/.test(s)) dot++;
  }
  if (comma === 0 && dot === 0) return undefined;
  return comma > dot ? "," : ".";
}

const MONTHS: Record<string, number> = {
  jan: 1, januar: 1, january: 1, janvier: 1, janv: 1, gen: 1, gennaio: 1, jän: 1, jänner: 1,
  feb: 2, februar: 2, february: 2, fev: 2, févr: 2, fevr: 2, février: 2, fevrier: 2, febbraio: 2,
  mar: 3, mär: 3, märz: 3, maerz: 3, march: 3, mars: 3, marzo: 3,
  apr: 4, april: 4, avr: 4, avril: 4, aprile: 4,
  mai: 5, may: 5, mag: 5, maggio: 5,
  jun: 6, juni: 6, june: 6, juin: 6, giu: 6, giugno: 6,
  jul: 7, juli: 7, july: 7, juil: 7, juillet: 7, lug: 7, luglio: 7,
  aug: 8, august: 8, aout: 8, août: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, septembre: 9, set: 9, settembre: 9,
  okt: 10, oct: 10, oktober: 10, october: 10, octobre: 10, ott: 10, ottobre: 10,
  nov: 11, november: 11, novembre: 11,
  dez: 12, dec: 12, dezember: 12, december: 12, déc: 12, décembre: 12, decembre: 12, dic: 12, dicembre: 12,
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parses dates as used in Swiss statements into ISO YYYY-MM-DD:
 * dd.mm.yyyy · dd.mm.yy · yyyy-mm-dd (optionally with time) · dd/mm/yyyy · dd-mm-yyyy · 3 Jul 2026 · Date objects.
 */
export function parseDate(input: unknown): string | null {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return toIso(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(s);
  if (m) return toIso(+m[1], +m[2], +m[3]);
  m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(s);
  if (m) return toIso(+m[1], +m[2], +m[3]);
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return toIso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})([./-])(\d{1,2})\2(\d{4}|\d{2})(?:$|[\s,T])/.exec(s);
  if (m) {
    let d = +m[1];
    let mo = +m[3];
    if (m[2] === "/" && mo > 12 && d <= 12) [d, mo] = [mo, d];
    return toIso(+m[4], mo, d);
  }
  m = /^(\d{1,2})\.?\s*([A-Za-zÀ-ÿ]{3,9})\.?\s*(\d{4}|\d{2})\b/.exec(s);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return toIso(+m[3], mo, +m[1]);
  }
  m = /^([A-Za-zÀ-ÿ]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(s);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) return toIso(+m[3], mo, +m[2]);
  }
  return null;
}

/** Lowercase, strip diacritics and punctuation — used to compare header names. */
export function normaliseKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Small, fast, stable string hash (cyrb53) rendered in base36. */
export function hashString(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
}

/** Is this a plausible ISO 4217 code cell value? */
export function looksLikeCurrency(s: string): boolean {
  return /^[A-Z]{3}$/.test(s.trim());
}
