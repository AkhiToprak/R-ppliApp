import { ShieldCheck, UserRoundX } from "lucide-react";
import type { Locale } from "@/lib/types";
import type { LandingT } from "@/lib/i18n/messages/landing";
import { SwissFlag } from "@/components/site/SwissFlag";
import { PillLink } from "./PillLink";
import { HeroVisual } from "./HeroVisual";

export function Hero({ locale, t }: { locale: Locale; t: LandingT }) {
  const badges = [
    { icon: <UserRoundX className="size-4" strokeWidth={2.25} />, label: t("badgeNoLogin") },
    { icon: <ShieldCheck className="size-4" strokeWidth={2.25} />, label: t("badgeNoStorage") },
    { icon: <SwissFlag className="size-4" />, label: t("badgeSwiss") },
  ];

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.08fr_1fr] lg:gap-8 lg:px-8 lg:pt-16 lg:pb-28">
        <div className="relative z-10">
          <h1
            id="hero-title"
            className="font-display text-[clamp(3.4rem,10vw,8.25rem)] leading-[0.88] font-extrabold tracking-[-0.05em] text-balance"
          >
            {t("heroTitle")}
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-paper/75 sm:text-xl">{t("heroLead")}</p>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <PillLink href={`/${locale}/analyse`} tone="paper">
              {t("ctaUpload")}
            </PillLink>
            <PillLink href={`/${locale}/analyse?sample=1`} tone="outline-dark">
              {t("ctaSample")}
            </PillLink>
          </div>

          <ul className="mt-10 flex flex-wrap gap-2">
            {badges.map((b) => (
              <li
                key={b.label}
                className="inline-flex items-center gap-2 rounded-full bg-paper/[0.07] px-3.5 py-2 text-sm font-semibold text-paper/85 ring-1 ring-paper/15 ring-inset"
              >
                {b.icon}
                {b.label}
              </li>
            ))}
          </ul>
        </div>

        <HeroVisual
          locale={locale}
          ariaLabel={t("heroVisualLabel")}
          labels={{
            greeting: t("mockGreeting"),
            spent: t("mockSpent"),
            score: t("mockScore"),
            persona: t("mockPersona"),
            saving: t("mockSaving"),
            perMonth: t("mockPerMonth"),
          }}
        />
      </div>
    </section>
  );
}
