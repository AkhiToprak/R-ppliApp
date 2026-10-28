import type { Locale } from "@/lib/types";
import type { LandingT } from "@/lib/i18n/messages/landing";
import { RappliCoin } from "@/components/brand/RappliCoin";
import { PillLink } from "./PillLink";
import { Reveal } from "./Reveal";

export function FinalCta({ locale, t }: { locale: Locale; t: LandingT }) {
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-coin text-ink">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 text-coin-dark/25 bg-halftone" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-24 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-8 lg:py-32">
        <Reveal>
          <h2
            id="cta-title"
            className="font-display text-[clamp(3rem,8vw,7rem)] leading-[0.9] font-extrabold tracking-[-0.05em] text-balance"
          >
            {t("ctaTitle")}
          </h2>
          <p className="mt-6 text-xl font-semibold sm:text-2xl">{t("ctaLead")}</p>
          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <PillLink href={`/${locale}/analyse`} tone="ink">
              {t("ctaUpload")}
            </PillLink>
            <PillLink href={`/${locale}/analyse?sample=1`} tone="outline-light" className="ring-ink/30">
              {t("ctaSample")}
            </PillLink>
          </div>
        </Reveal>
        <div aria-hidden className="relative mx-auto grid place-items-center">
          <div className="absolute size-[120%] rounded-full bg-[radial-gradient(closest-side,rgb(255_216_77/0.9),transparent)]" />
          <div className="relative origin-center scale-[0.7] sm:scale-90 lg:scale-100">
            <RappliCoin size={300} animated />
          </div>
        </div>
      </div>
    </section>
  );
}
