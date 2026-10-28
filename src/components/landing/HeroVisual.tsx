"use client";

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import clsx from "clsx";
import type { CategoryId, Locale } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "@/components/analyse/ui";
import { RappliCoin } from "@/components/brand/RappliCoin";
import { PhoneMockup, type PhoneLabels } from "./PhoneMockup";

type Chip = {
  merchant: string;
  cat: CategoryId;
  pos: string;
  /** parallax travel in px over the first 700px of scroll */
  depth: number;
  tilt: number;
  smOnly?: boolean;
};

const CHIPS: Chip[] = [
  { merchant: "Migros", cat: "groceries", pos: "left-0 top-[10%]", depth: -70, tilt: -6 },
  { merchant: "SBB", cat: "transport", pos: "right-0 top-[40%]", depth: -130, tilt: 5 },
  { merchant: "Netflix", cat: "subscriptions", pos: "left-0 bottom-[24%]", depth: -40, tilt: 4 },
  { merchant: "Uber Eats", cat: "restaurants", pos: "right-[2%] bottom-[6%]", depth: -100, tilt: -4 },
  { merchant: "Swisscom", cat: "telecom", pos: "left-[3%] top-[44%]", depth: -160, tilt: 3, smOnly: true },
  { merchant: "Galaxus", cat: "shopping", pos: "left-[14%] bottom-[2%]", depth: -60, tilt: -3, smOnly: true },
];

function FloatingChip({ chip, index, locale, scrollY }: { chip: Chip; index: number; locale: Locale; scrollY: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const y = useTransform(scrollY, [0, 700], [0, chip.depth]);
  const meta = CATEGORIES[chip.cat];

  return (
    <motion.div
      className={clsx("absolute z-20 will-change-transform", chip.pos, chip.smOnly && "hidden sm:block")}
      style={reduce ? undefined : { y }}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.5, rotate: 0 }}
        animate={{ opacity: 1, scale: 1, rotate: chip.tilt }}
        transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.7 + index * 0.12 }}
      >
        <div
          className="flex animate-bob items-center gap-2.5 rounded-full bg-paper py-1.5 pr-4 pl-1.5 text-ink shadow-[0_18px_40px_-12px_rgb(0_0_0/0.55)]"
          style={{ animationDuration: `${3.6 + index * 0.45}s`, animationDelay: `${index * 0.3}s` }}
        >
          <span
            className="grid size-9 place-items-center rounded-full text-ink"
            style={{ background: meta.color }}
          >
            <CategoryIcon id={chip.cat} size={18} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold">{chip.merchant}</span>
            <span className="block max-w-[9.5rem] truncate text-[0.7rem] font-semibold text-muted">{meta.label[locale]}</span>
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Hero illustration: coin, phone dashboard and merchant→category chips, with parallax. */
export function HeroVisual({ locale, labels, ariaLabel }: { locale: Locale; labels: PhoneLabels; ariaLabel: string }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const coinY = useTransform(scrollY, [0, 700], [0, -180]);
  const coinRotate = useTransform(scrollY, [0, 700], [0, 40]);
  const phoneY = useTransform(scrollY, [0, 700], [0, 60]);

  return (
    <div role="img" aria-label={ariaLabel} className="relative mx-auto h-[560px] w-full max-w-[540px] sm:h-[600px] lg:h-[640px]">
      {/* coin, stuck like a sticker on the phone's top-right corner */}
      <motion.div
        className="absolute -top-[2%] -right-[2%] z-30 origin-top-right scale-[0.6] will-change-transform sm:scale-[0.75] lg:scale-[0.85]"
        style={reduce ? undefined : { y: coinY, rotate: coinRotate }}
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -80, rotate: -40 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 12, delay: 0.1 }}
        >
          <RappliCoin size={240} animated />
        </motion.div>
      </motion.div>

      {/* phone */}
      <motion.div className="absolute top-1/2 left-1/2 z-10 will-change-transform" style={reduce ? undefined : { y: phoneY }}>
        <motion.div
          className="-translate-x-1/2 -translate-y-1/2 scale-[0.86] sm:scale-100"
          initial={reduce ? false : { opacity: 0, y: 120, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: 7 }}
          transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.25 }}
        >
          <PhoneMockup locale={locale} labels={labels} />
        </motion.div>
      </motion.div>

      {CHIPS.map((chip, i) => (
        <FloatingChip key={chip.merchant} chip={chip} index={i} locale={locale} scrollY={scrollY} />
      ))}
    </div>
  );
}
