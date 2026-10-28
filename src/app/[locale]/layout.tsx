import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { isLocale, LOCALES } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/core";
import { commonMessages } from "@/lib/i18n/messages/common";
import "../globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(commonMessages, locale);
  return {
    title: { default: `Räppli – ${t("tagline")}`, template: "%s · Räppli" },
    description: t("metaDescription"),
    icons: { icon: "/icon.svg" },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
