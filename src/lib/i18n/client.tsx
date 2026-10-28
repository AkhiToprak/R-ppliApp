"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { Locale } from "@/lib/types";
import { format, type MessageDict } from "./core";

const LocaleContext = createContext<Locale>("de");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Client translator: `const t = useT(landingMessages); t("heroTitle")`. */
export function useT<K extends string>(dict: MessageDict<K>) {
  const locale = useLocale();
  return useCallback(
    (key: K, vars?: Record<string, string | number>) => format(dict[locale][key] ?? dict.de[key] ?? key, vars),
    [dict, locale],
  );
}

