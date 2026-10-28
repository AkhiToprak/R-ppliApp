import type { LandingT } from "@/lib/i18n/messages/landing";
import { FaqAccordion, type FaqItem } from "./FaqAccordion";
import { Reveal } from "./Reveal";

export function FaqSection({ t }: { t: LandingT }) {
  const items: FaqItem[] = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
    {
      q: t("faq6Q"),
      a: t("faq6A"),
      list: [
        { label: "UBS", text: t("exportUbs") },
        { label: "PostFinance", text: t("exportPostfinance") },
        { label: "Raiffeisen", text: t("exportRaiffeisen") },
        { label: "ZKB", text: t("exportZkb") },
        { label: "Revolut", text: t("exportRevolut") },
        { label: "neon / Yuh", text: t("exportNeonYuh") },
      ],
    },
    { q: t("faq7Q"), a: t("faq7A") },
  ];

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-mist py-24 sm:py-32 lg:py-40">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8">
        <Reveal>
          <h2
            id="faq-title"
            className="font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance lg:sticky lg:top-32"
          >
            {t("faqTitle")}
          </h2>
        </Reveal>
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}
