"use client";

import Link from "next/link";
import { RappliLogo } from "@/components/brand/RappliCoin";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";
import { commonMessages } from "@/lib/i18n/messages/common";
import { SwissFlag } from "./SwissFlag";

const linkCls = "focus-ring rounded-md text-paper/70 transition-colors hover:text-paper";

/** Ink footer: logo + tagline, links, language links, disclaimer. */
export function SiteFooter() {
  const locale = useLocale();
  const t = useT(commonMessages);

  const links = [
    { href: `/${locale}/analyse`, label: t("ctaAnalyse") },
    { href: `/${locale}/analyse?sample=1`, label: t("trySample") },
    { href: `/${locale}#how`, label: t("navHow") },
    { href: `/${locale}#privacy`, label: t("navPrivacy") },
    { href: `/${locale}#faq`, label: t("navFaq") },
  ];

  return (
    <footer className="relative overflow-hidden bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-20 pb-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <Link href={`/${locale}`} aria-label={t("homeLink")} className="focus-ring inline-block rounded-full">
            <RappliLogo size={44} invert />
          </Link>
          <p className="mt-6 font-display text-2xl leading-tight font-bold tracking-tight">{t("tagline")}</p>
          <p className="mt-4 flex items-start gap-2 text-sm text-paper/60">
            <SwissFlag className="mt-0.5 size-4 shrink-0" />
            <span>{t("footerMade")}</span>
          </p>
        </div>

        <nav aria-label={t("navMain")}>
          <ul className="space-y-3 text-[0.95rem]">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("language")}>
          <h2 className="mb-3 text-sm font-semibold text-paper">{t("language")}</h2>
          <ul className="space-y-3 text-[0.95rem]">
            {LOCALES.map((l) => (
              <li key={l}>
                <Link
                  href={`/${l}`}
                  hrefLang={l}
                  lang={l}
                  aria-current={l === locale ? "true" : undefined}
                  className={l === locale ? "focus-ring rounded-md font-semibold text-coin" : linkCls}
                >
                  {LOCALE_LABELS[l]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-paper/10 px-4 py-6 text-sm text-paper/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>{t("footerDisclaimer")}</p>
        <p>© 2026 Räppli</p>
      </div>

      {/* Oversized wordmark, cropped by the footer's bottom edge. */}
      <div aria-hidden className="pointer-events-none select-none">
        <p className="-mb-[0.32em] text-center font-display text-[clamp(5rem,24vw,22rem)] leading-none font-extrabold tracking-[-0.06em] text-paper/[0.06]">
          Räppli
        </p>
      </div>
    </footer>
  );
}
