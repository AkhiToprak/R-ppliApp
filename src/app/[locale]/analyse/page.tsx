import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyseApp } from "@/components/analyse/AnalyseApp";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { isLocale } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/core";
import { analyseMessages } from "@/lib/i18n/messages/analyse";

export async function generateMetadata({ params }: PageProps<"/[locale]/analyse">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(analyseMessages, locale);
  return { title: t("metaTitle"), robots: { index: true, follow: true } };
}

// Upload → processing → dashboard. Everything after the static shell runs in the browser;
// `?sample=1` is read on the client so this route stays fully static.
export default async function AnalysePage({ params }: PageProps<"/[locale]/analyse">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <>
      <SiteHeader showCta={false} />
      <main id="main" className="flex flex-1 flex-col">
        <AnalyseApp />
      </main>
      <SiteFooter />
    </>
  );
}
