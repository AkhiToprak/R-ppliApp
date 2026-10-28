"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, type MouseEvent } from "react";
import clsx from "clsx";
import type { Locale } from "@/lib/types";
import { isLocale, LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";

/** Swaps the leading /{locale} segment of a pathname, keeping the rest. */
export function swapLocale(pathname: string, next: Locale) {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) parts[1] = next;
  else parts.splice(1, 0, next);
  const out = parts.join("/");
  return out.endsWith("/") && out.length > 1 ? out.slice(0, -1) : out;
}

type Props = { tone?: "light" | "dark"; className?: string };

function Pills({ hrefFor, tone = "light", className }: Props & { hrefFor: (l: Locale) => string }) {
  const locale = useLocale();
  const t = useT(commonMessages);
  const router = useRouter();

  // Keep ?query and #hash (e.g. /analyse?sample=1) when switching language.
  function onClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    const { search, hash } = window.location;
    if (!search && !hash) return;
    e.preventDefault();
    router.push(`${href}${search}${hash}`);
  }

  return (
    <nav aria-label={t("language")} className={className}>
      <ul
        className={clsx(
          "flex items-center gap-0.5 rounded-full p-1",
          tone === "dark" ? "bg-paper/10" : "bg-mist",
        )}
      >
        {LOCALES.map((l) => {
          const active = l === locale;
          const href = hrefFor(l);
          return (
            <li key={l}>
              <Link
                href={href}
                hrefLang={l}
                lang={l}
                aria-current={active ? "true" : undefined}
                title={LOCALE_LABELS[l]}
                onClick={(e) => onClick(e, href)}
                className={clsx(
                  "focus-ring grid h-8 min-w-10 place-items-center rounded-full px-2.5 text-xs font-bold tracking-wide uppercase transition-colors",
                  active
                    ? tone === "dark"
                      ? "bg-paper text-ink"
                      : "bg-ink text-paper"
                    : tone === "dark"
                      ? "text-paper/70 hover:text-paper"
                      : "text-ink/60 hover:text-ink",
                )}
              >
                <span className="sr-only">{LOCALE_LABELS[l]}</span>
                <span aria-hidden>{l}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function PathPills(props: Props) {
  const pathname = usePathname() ?? "/";
  return <Pills {...props} hrefFor={(l) => swapLocale(pathname, l)} />;
}

/**
 * DE / FR / IT / EN pills. Swaps the /{locale} prefix of the current path.
 * Wrapped in Suspense because `usePathname` can suspend under cacheComponents on
 * routes with unknown params; the fallback links to each locale's home page.
 */
export function LanguageSwitcher(props: Props) {
  return (
    <Suspense fallback={<Pills {...props} hrefFor={(l) => `/${l}`} />}>
      <PathPills {...props} />
    </Suspense>
  );
}
