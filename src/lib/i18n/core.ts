import type { Locale } from "@/lib/types";
import { INTL_LOCALE } from "./config";

/**
 * Messages are grouped per feature in `./messages/<namespace>.ts`, each file
 * exporting `defineMessages({ de, fr, it, en })`. German is the source of truth;
 * the other locales must have exactly the same keys (enforced by the type).
 *
 * Swiss conventions: German uses "ss" (never "ß"), amounts are CHF with
 * apostrophe thousands separators (1'234.50), dates dd.mm.yyyy.
 */
export function defineMessages<const T extends Record<string, string>>(m: {
  de: T;
  fr: Record<keyof T, string>;
  it: Record<keyof T, string>;
  en: Record<keyof T, string>;
}) {
  return m as Record<Locale, Record<keyof T, string>>;
}

export type MessageDict<K extends string = string> = Record<Locale, Record<K, string>>;

/** Interpolates `{name}` placeholders. */
export function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Server-safe translator factory. */
export function getT<K extends string>(dict: MessageDict<K>, locale: Locale) {
  return (key: K, vars?: Record<string, string | number>) => format(dict[locale][key] ?? dict.de[key] ?? key, vars);
}

/** CHF formatting: `formatMoney(1234.5, "de")` → "CHF 1’234.50". */
export function formatMoney(amount: number, locale: Locale, opts?: { decimals?: 0 | 2; currency?: string; sign?: boolean }) {
  const decimals = opts?.decimals ?? 2;
  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: opts?.currency ?? "CHF",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));
  // Intl puts the sign between code and number ("CHF+1’932"); "+CHF 1’932" reads better.
  const sign = amount < 0 ? "−" : opts?.sign && amount > 0 ? "+" : "";
  return sign + formatted;
}

export function formatPercent(value: number, locale: Locale, decimals = 0) {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "percent",
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(iso: string, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], opts).format(new Date(`${iso}T12:00:00`));
}

export function formatMonth(yyyyMm: string, locale: Locale, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: style, year: "2-digit" }).format(new Date(`${yyyyMm}-15T12:00:00`));
}
