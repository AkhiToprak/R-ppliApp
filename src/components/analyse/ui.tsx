"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import clsx from "clsx";
import {
  ArrowLeftRight,
  Baby,
  Banknote,
  Car,
  CircleQuestionMark,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  PiggyBank,
  Plane,
  PlugZap,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Ticket,
  TrainFront,
  UtensilsCrossed,
  Wallet,
  type LucideProps,
} from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";
import type { CategoryId } from "@/lib/types";

/* ---------------------------------------------------------------- layout */

export function Card({
  children,
  className,
  id,
  labelledBy,
  tone = "mist",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
  tone?: "mist" | "paper" | "ink";
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={clsx(
        "min-w-0 rounded-[2rem] p-5 sm:p-7",
        tone === "mist" && "bg-mist text-ink",
        tone === "paper" && "border border-fog bg-paper text-ink",
        tone === "ink" && "bg-ink text-paper",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({ id, children, aside }: { id?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <h2 id={id} className="font-display text-2xl leading-tight font-extrabold tracking-tight sm:text-[1.75rem]">
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-2xl bg-fog/80", className)} />;
}

/* ---------------------------------------------------------------- numbers */

/** Animates a number from 0 (or its previous value) once it scrolls into view. */
export function CountUp({
  value,
  format,
  duration = 1.1,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  // React never re-renders this text; the effect drives it imperatively.
  const [initialText] = useState(() => format(reduce ? value : 0));

  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = formatRef.current(value);
      from.current = value;
      return;
    }
    if (!inView) {
      el.textContent = formatRef.current(from.current);
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = formatRef.current(v);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, duration]);

  return (
    <span ref={ref} className={className}>
      {initialText}
    </span>
  );
}

export function useCompactNumber() {
  const locale = useLocale();
  return (n: number) =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/* ---------------------------------------------------------------- categories */

const ICONS: Record<CategoryId, ComponentType<LucideProps>> = {
  groceries: ShoppingBasket,
  restaurants: UtensilsCrossed,
  transport: TrainFront,
  car: Car,
  housing: House,
  utilities: PlugZap,
  telecom: Smartphone,
  insurance: ShieldCheck,
  health: HeartPulse,
  shopping: ShoppingBag,
  leisure: Ticket,
  subscriptions: Repeat,
  travel: Plane,
  education: GraduationCap,
  children: Baby,
  taxes: Landmark,
  fees: Receipt,
  cash: Banknote,
  savings: PiggyBank,
  transfers: ArrowLeftRight,
  income: Wallet,
  other: CircleQuestionMark,
};

export function CategoryIcon({ id, size = 16, className }: { id: CategoryId; size?: number; className?: string }) {
  const Icon = ICONS[id] ?? CircleQuestionMark;
  return <Icon size={size} aria-hidden className={className} strokeWidth={2.25} />;
}

/** Round icon badge tinted with the category colour; the icon itself stays ink for contrast. */
export function CategoryBadge({ id, size = 36 }: { id: CategoryId; size?: number }) {
  const color = CATEGORIES[id]?.color ?? "#d0d0da";
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full text-ink"
      style={{ width: size, height: size, background: `${color}33`, boxShadow: `inset 0 0 0 2px ${color}` }}
    >
      <CategoryIcon id={id} size={Math.round(size * 0.46)} />
    </span>
  );
}

export function CategoryChip({ id, className }: { id: CategoryId; className?: string }) {
  const locale = useLocale();
  const meta = CATEGORIES[id] ?? CATEGORIES.other;
  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink",
        className,
      )}
      style={{ background: `${meta.color}26` }}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: meta.color }} />
      <span className="truncate">{meta.label[locale]}</span>
    </span>
  );
}

/** Shared easing for entrances. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Stagger container + item variants for card grids. */
export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
export const staggerChild = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};
