import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { MerchantMarquee } from "@/components/landing/MerchantMarquee";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { PrivacySection } from "@/components/landing/PrivacySection";
import { BanksSection } from "@/components/landing/BanksSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/core";
import { commonMessages } from "@/lib/i18n/messages/common";
import { landingMessages } from "@/lib/i18n/messages/landing";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale: raw } = await params;
  // The layout already 404s on unknown locales; this only narrows the type.
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = getT(landingMessages, locale);
  const tc = getT(commonMessages, locale);

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-coin px-5 py-3 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {tc("skipToContent")}
      </a>
      <SiteHeader variant="dark" />
      <main id="main" className="flex-1 overflow-x-clip">
        <Hero locale={locale} t={t} />
        <MerchantMarquee t={t} />
        <HowItWorks t={t} />
        <FeatureGrid locale={locale} t={t} />
        <PrivacySection locale={locale} t={t} />
        <BanksSection t={t} />
        <FaqSection t={t} />
        <FinalCta locale={locale} t={t} />
      </main>
      <SiteFooter />
    </>
  );
}
