// Removes personal data from statement text before it leaves the browser (PDF → /api/extract).

export const MAX_EXTRACT_CHARS = 60_000;

const AHV = /\b756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}\b/g;
const EMAIL = /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){0,5}\.[A-Z]{2,24}/gi;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;
const MASKED_CARD = /\b\d{4,6}[ -]?(?:[x*•]{2,}[ -]?)+\d{0,4}\b|(^|\s)[x*•]{2,}(?:[ -]?[x*•]{2,})*[ -]?\d{2,4}\b/gim;
const PHONE_INTL = /(?:\+|\b00)\d{2,3}[\s./-]?(?:\(0\)\s?)?\d{2}(?:[\s./-]?\d{2,3}){2,4}\b/g;
const PHONE_CH = /\b0\d{2}[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}\b/g;
const LONG_DIGITS = /\b\d{7,}\b/g;

const STREET =
  /\p{L}[\p{L}.-]*(?:strasse|straße|str\.|weg|gasse|platz|rain|allee|ring|quai|halde|hof|matte|acker)\s+\d+\s*[a-z]?\b|\b(?:rue|avenue|av\.|chemin|ch\.|route|boulevard|bd|place|via|viale|piazza|corso|vicolo)\s+[\p{L}\s'.-]+\d*|\b\d+\s*[a-z]?,?\s+(?:rue|avenue|chemin|route)\b/iu;
const POSTAL_CITY = /^\s*(?:CH[- ])?[1-9]\d{3}\s+\p{L}[\p{L} .'-]*$/u;
const SALUTATION = /^\s*(?:herr(?:n)?|frau|familie|monsieur|madame|m\.|mme|signor(?:a)?|sig\.(?:ra)?|mr\.?|mrs\.?|ms\.?)\b/i;
const HOLDER_LABEL =
  /\b(kontoinhaber(?:in)?|inhaber(?:in)?|titulaire(?: du compte)?|titolare(?: del conto)?|account holder|name|nom|nome)\s*:\s*.+$/i;
const LOOKS_LIKE_TX = /^\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|^\s*\d{4}-\d{2}-\d{2}/;

/** Best-effort redaction of the account holder's name/address block at the top of the statement. */
function redactHeaderBlock(lines: string[]): string[] {
  const firstTx = lines.findIndex((l) => LOOKS_LIKE_TX.test(l));
  const limit = Math.min(firstTx >= 0 ? firstTx : 25, 25, lines.length);
  const out = [...lines];
  for (let i = 0; i < limit; i++) {
    const line = out[i];
    if (!line.trim() || line.length > 200) continue;
    if (SALUTATION.test(line)) {
      out[i] = "[NAME]";
      // name usually follows the salutation on the next line when the salutation stands alone
      if (line.trim().split(/\s+/).length <= 2 && i + 1 < limit && out[i + 1].trim()) out[i + 1] = "[NAME]";
      continue;
    }
    if (line.length < 80 && STREET.test(line)) {
      out[i] = "[ADDRESS]";
      // name line directly above the street (if short and not already redacted)
      const prev = i - 1;
      if (prev >= 0 && out[prev].trim() && !out[prev].startsWith("[") && out[prev].trim().split(/\s+/).length <= 5 && !/\d/.test(out[prev])) {
        out[prev] = "[NAME]";
      }
      continue;
    }
    if (POSTAL_CITY.test(line) && line.length < 60) {
      out[i] = "[ADDRESS]";
      continue;
    }
    const holder = HOLDER_LABEL.exec(line);
    if (holder) out[i] = line.slice(0, holder.index) + `${holder[1]}: [NAME]`;
  }
  return out;
}

/**
 * Redacts IBANs, card numbers, long digit runs, e-mail addresses, phone numbers, AHV numbers and
 * (best effort) the holder's address block. Output is capped at MAX_EXTRACT_CHARS.
 */
export function redact(text: string, maxChars = MAX_EXTRACT_CHARS): string {
  // cap before and after: the regexes below are linear-ish but there is no point scanning megabytes
  let s = text.slice(0, maxChars * 2).replace(/\r\n?/g, "\n");
  s = redactHeaderBlock(s.split("\n")).join("\n");
  s = s
    .replace(AHV, "[AHV]")
    .replace(EMAIL, "[EMAIL]")
    .replace(IBAN, (m) => (/\d{4}/.test(m.slice(4).replace(/\s/g, "")) ? "[IBAN]" : m))
    .replace(PHONE_INTL, "[PHONE]")
    .replace(CARD, "[CARD]")
    .replace(MASKED_CARD, (_m, lead?: string) => `${lead ?? ""}[CARD]`)
    .replace(PHONE_CH, "[PHONE]")
    .replace(LONG_DIGITS, "[NUM]");
  if (s.length > maxChars) s = s.slice(0, maxChars);
  return s;
}
