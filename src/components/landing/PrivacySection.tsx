import { DoorClosed, Eye, EyeOff, MonitorSmartphone, ServerOff, Sparkles, UserRoundX } from "lucide-react";
import type { Locale } from "@/lib/types";
import type { LandingT } from "@/lib/i18n/messages/landing";
import { formatMoney } from "@/lib/i18n/core";
import { Reveal } from "./Reveal";
import { PrivacyLock } from "./PrivacyLock";

export function PrivacySection({ locale, t }: { locale: Locale; t: LandingT }) {
  const points = [
    { Icon: MonitorSmartphone, title: t("p1Title"), text: t("p1Text") },
    { Icon: UserRoundX, title: t("p2Title"), text: t("p2Text") },
    { Icon: ServerOff, title: t("p3Title"), text: t("p3Text") },
    { Icon: Sparkles, title: t("p4Title"), text: t("p4Text") },
    { Icon: DoorClosed, title: t("p5Title"), text: t("p5Text") },
  ];
  const sent = [
    ["Uber Eats", 186],
    ["Migros", 742],
    ["Swisscom", 69],
  ] as const;
  const kept = [t("aiSeesName"), t("aiSeesIban"), t("aiSeesBalance"), t("aiSeesAddress")];

  return (
    <section
      id="privacy"
      aria-labelledby="privacy-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-ink py-24 text-paper sm:py-32 lg:py-40"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(123_92_255/0.35),transparent)]" />
        <div className="absolute -right-40 bottom-0 size-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(25_211_162/0.22),transparent)]" />
      </div>

      <div className="mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <div>
          <Reveal>
            <h2
              id="privacy-title"
              className="font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance"
            >
              {t("privacyTitle")}
            </h2>
            <p className="mt-6 max-w-md text-xl leading-relaxed text-paper/70">{t("privacyLead")}</p>
          </Reveal>
          <div className="mt-20 lg:mt-24">
            <PrivacyLock />
          </div>
        </div>

        <div className="flex flex-col gap-10">
          <ul className="divide-y divide-paper/10">
            {points.map(({ Icon, title, text }, i) => (
              <li key={title} className="py-6 first:pt-0 last:pb-0">
                <Reveal delay={i * 0.06} y={16} className="flex gap-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paper/[0.08] text-coin-light ring-1 ring-paper/10">
                    <Icon className="size-6" strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
                    <p className="mt-1 leading-relaxed text-paper/65">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <Reveal>
            <figure className="rounded-[2rem] bg-ink-soft p-6 ring-1 ring-paper/10 sm:p-8">
              <figcaption className="font-display text-xl font-bold tracking-tight">{t("aiSeesTitle")}</figcaption>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-mint">
                    <Eye className="size-4" aria-hidden />
                    {t("aiSeesSent")}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {sent.map(([name, amount]) => (
                      <li key={name} className="flex items-center justify-between gap-3 rounded-xl bg-paper/[0.06] px-3.5 py-2.5 text-sm">
                        <span className="font-semibold">{name}</span>
                        <span className="tabular-nums text-paper/80">{formatMoney(amount, locale, { decimals: 0 })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-pink">
                    <EyeOff className="size-4" aria-hidden />
                    {t("aiSeesKept")}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {kept.map((label) => (
                      <li
                        key={label}
                        className="rounded-xl px-3.5 py-2.5 text-sm text-paper/50 line-through decoration-pink/70 decoration-2 ring-1 ring-paper/10 ring-inset"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
