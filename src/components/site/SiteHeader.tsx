"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import { RappliLogo } from "@/components/brand/RappliCoin";
import { PillLink } from "@/components/landing/PillLink";
import { useLocale, useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * Sticky top bar: logo, section anchors, DE/FR/IT/EN switcher and CTA.
 * `variant="dark"` = white on ink, for pages that open with a black hero.
 * Gains a blurred translucent background once the page is scrolled.
 */
export function SiteHeader({ variant = "light", showCta = true }: { variant?: "light" | "dark"; showCta?: boolean }) {
  const locale = useLocale();
  const t = useT(commonMessages);
  const reduce = useReducedMotion();
  const dark = variant === "dark";
  const menuId = useId();

  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = [
    { href: `/${locale}#how`, label: t("navHow") },
    { href: `/${locale}#privacy`, label: t("navPrivacy") },
    { href: `/${locale}#faq`, label: t("navFaq") },
  ];

  return (
    <header
      data-variant={variant}
      className={clsx(
        "sticky top-0 z-50 w-full transition-[background-color,box-shadow] duration-300",
        dark ? "text-paper" : "text-ink",
        dark
          ? scrolled || open
            ? "bg-ink/85 shadow-[0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-md"
            : "bg-ink"
          : scrolled || open
            ? "bg-paper/85 shadow-[0_1px_0_rgb(11_11_15/0.08)] backdrop-blur-md"
            : "bg-paper",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link href={`/${locale}`} aria-label={t("homeLink")} className="focus-ring -m-1 shrink-0 rounded-full p-1">
          <RappliLogo size={36} invert={dark} />
        </Link>

        <nav aria-label={t("navMain")} className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "focus-ring rounded-full px-4 py-2 text-[0.95rem] font-semibold transition-colors",
                    dark ? "text-paper/75 hover:bg-paper/10 hover:text-paper" : "text-ink/70 hover:bg-ink/5 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher tone={dark ? "dark" : "light"} className="hidden md:block" />
          {showCta && (
            // Wrapper owns the display toggle: PillLink's own `inline-flex` would override `hidden`.
            <span className="hidden sm:inline-flex">
              <PillLink href={`/${locale}/analyse`} tone={dark ? "paper" : "ink"} size="md">
                {t("ctaAnalyse")}
              </PillLink>
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? t("menuClose") : t("menuOpen")}
            className={clsx(
              "focus-ring grid size-11 place-items-center rounded-full transition-colors lg:hidden",
              dark ? "bg-paper/10 hover:bg-paper/20" : "bg-mist hover:bg-fog",
            )}
          >
            {open ? <X className="size-5" strokeWidth={2.5} /> : <Menu className="size-5" strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={menuId}
            key="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-x-0 top-full px-3 pb-3 lg:hidden"
          >
            <div
              className={clsx(
                "rounded-[2rem] p-3 shadow-2xl",
                dark ? "bg-ink-soft text-paper ring-1 ring-paper/10" : "bg-paper text-ink ring-1 ring-ink/10",
              )}
            >
              <nav aria-label={t("navMain")}>
                <ul className="flex flex-col">
                  {nav.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={clsx(
                          "focus-ring block rounded-2xl px-4 py-3.5 font-display text-2xl font-bold tracking-tight",
                          dark ? "hover:bg-paper/10" : "hover:bg-mist",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
                <LanguageSwitcher tone={dark ? "dark" : "light"} className="md:hidden" />
                {showCta && (
                  <span className="sm:hidden">
                    <PillLink
                      href={`/${locale}/analyse`}
                      tone={dark ? "paper" : "ink"}
                      size="md"
                      onClick={() => setOpen(false)}
                    >
                      {t("ctaAnalyse")}
                    </PillLink>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
