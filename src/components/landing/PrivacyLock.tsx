"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { RappliCoin } from "@/components/brand/RappliCoin";

/** Padlock whose shackle snaps shut when scrolled into view; the coin is the keyhole. */
export function PrivacyLock() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const play = inView || !!reduce;

  return (
    <div ref={ref} aria-hidden className="relative mx-auto w-[260px] sm:w-[320px]">
      <motion.svg
        viewBox="0 0 320 200"
        className="relative z-0 -mb-20 w-full"
        initial={reduce ? false : { y: -56 }}
        animate={play ? { y: 0 } : undefined}
        transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.35 }}
      >
        <path
          d="M88 200 V118 a72 72 0 0 1 144 0 V200"
          fill="none"
          stroke="var(--color-paper)"
          strokeWidth="30"
          strokeLinecap="round"
        />
      </motion.svg>
      <div className="relative z-10 grid h-[210px] place-items-center rounded-[2.75rem] bg-rainbow shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] sm:h-[250px]">
        <motion.div
          initial={false}
          animate={play && !reduce ? { rotate: [0, -14, 10, -4, 0], scale: [1, 1.08, 1] } : undefined}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="rounded-full shadow-[0_10px_0_rgb(11_11_15/0.25)]"
        >
          <RappliCoin size={124} animated />
        </motion.div>
      </div>
    </div>
  );
}
