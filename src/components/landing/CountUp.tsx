"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/i18n/core";

/** Counts from 0 to `value` once it scrolls into view. Tabular figures avoid jitter. */
export function CountUp({
  value,
  locale,
  money = false,
  duration = 1.6,
  delay = 0,
  className,
}: {
  value: number;
  locale: Locale;
  money?: boolean;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setCurrent(v),
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration, delay]);

  const shown = reduce ? value : Math.round(current);
  const text = money
    ? formatMoney(shown, locale, { decimals: 0 })
    : new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(shown);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </span>
  );
}
