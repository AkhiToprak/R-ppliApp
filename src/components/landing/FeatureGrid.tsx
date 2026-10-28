import clsx from "clsx";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/types";
import type { LandingT } from "@/lib/i18n/messages/landing";
import { Reveal } from "./Reveal";
import { TiltCard } from "./TiltCard";
import {
  CategoriseIllo,
  ChartsIllo,
  CritiqueIllo,
  LanguagesIllo,
  SavingsIllo,
  ScoreIllo,
  StrengthsIllo,
} from "./FeatureIllustrations";

function Card({
  title,
  text,
  tint,
  dark,
  className,
  delay = 0,
  children,
}: {
  title: string;
  text?: string;
  /** CSS colour mixed into white for a pastel background. */
  tint?: string;
  dark?: boolean;
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <Reveal delay={delay} className={clsx("h-full", className)}>
      <TiltCard className="h-full">
        <article
          className={clsx(
            "flex h-full flex-col gap-8 rounded-[2rem] p-6 sm:p-8",
            dark ? "bg-ink text-paper" : "text-ink",
          )}
          style={tint ? { background: `color-mix(in oklab, ${tint} 17%, white)` } : undefined}
        >
          <div className="flex flex-1 flex-col justify-center">{children}</div>
          <div>
            <h3 className="font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">{title}</h3>
            {text && (
              <p className={clsx("mt-2 max-w-md leading-relaxed", dark ? "text-paper/70" : "text-ink/70")}>{text}</p>
            )}
          </div>
        </article>
      </TiltCard>
    </Reveal>
  );
}

export function FeatureGrid({ locale, t }: { locale: Locale; t: LandingT }) {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 bg-mist py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="features-title"
            className="max-w-4xl font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance"
          >
            {t("featuresTitle")}
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:mt-20 lg:grid-cols-6 lg:gap-5">
          <Card
            className="md:col-span-2 lg:col-span-4"
            tint="var(--color-sky)"
            title={t("fCatTitle")}
          >
            <CategoriseIllo locale={locale} />
          </Card>
          <Card
            className="lg:col-span-2"
            tint="var(--color-mint)"
            title={t("fScoreTitle")}
            text={t("fScoreText")}
            delay={0.08}
          >
            <ScoreIllo locale={locale} persona={t("mockPersona")} />
          </Card>
          <Card
            className="lg:col-span-3"
            tint="var(--color-violet)"
            title={t("fChartsTitle")}
          >
            <ChartsIllo locale={locale} />
          </Card>
          <Card
            className="md:col-span-2 lg:col-span-3"
            tint="var(--color-pink)"
            title={t("fCritiqueTitle")}
            text={t("fCritiqueText")}
            delay={0.08}
          >
            <CritiqueIllo quote={t("fCritiqueQuote")} />
          </Card>
          <Card className="lg:col-span-2" tint="var(--color-sun)" title={t("fSwTitle")}>
            <StrengthsIllo
              strengths={[t("fSwStrength1"), t("fSwStrength2")]}
              weaknesses={[t("fSwWeak1"), t("fSwWeak2")]}
            />
          </Card>
          <Card
            className="lg:col-span-2"
            tint="var(--color-orange)"
            title={t("fSaveTitle")}
            text={t("fSaveText")}
            delay={0.08}
          >
            <SavingsIllo
              locale={locale}
              items={[
                { text: t("fSave3"), amount: 134, effort: t("effortMedium") },
                { text: t("fSave1"), amount: 62, effort: t("effortEasy") },
                { text: t("fSave2"), amount: 18, effort: t("effortEasy") },
              ]}
            />
          </Card>
          <Card
            className="md:col-span-2 lg:col-span-2"
            dark
            title={t("fLangTitle")}
            text={t("fLangText")}
            delay={0.16}
          >
            <LanguagesIllo locale={locale} />
          </Card>
        </div>
      </div>
    </section>
  );
}
