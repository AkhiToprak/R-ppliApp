// Bank name detection from free text (CSV preamble, PDF text).

const TEXTUAL: [RegExp, string][] = [
  [/postfinance/i, "PostFinance"],
  [/raiffeisen/i, "Raiffeisen"],
  [/z(?:ü|ue|u)rcher kantonalbank|\bzkb\b/i, "ZKB"],
  [/credit suisse/i, "Credit Suisse"],
  [/migros bank/i, "Migros Bank"],
  [/banque cantonale vaudoise|\bbcv\b/i, "BCV"],
  [/banque cantonale de gen(?:è|e)ve|\bbcge\b/i, "BCGE"],
  [/bancastato|banca dello stato/i, "BancaStato"],
  [/swissquote/i, "Swissquote"],
  [/revolut/i, "Revolut"],
  [/\bneon\b/i, "neon"],
  [/\byuh\b/i, "Yuh"],
  [/\bubs\b/i, "UBS"],
];

export function detectBankFromText(text: string): string | undefined {
  for (const [re, bank] of TEXTUAL) if (re.test(text)) return bank;
  return undefined;
}
