"use client";

import { useRef, type CSSProperties } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { CoinArt, COIN_GOLD, COIN_INK } from "./CoinArt";

export { CoinArt } from "./CoinArt";

export interface RappliCoinProps {
  size?: number;
  /** idle float/wobble + periodic shine sweep (CSS, compositor-only); playful 3D flip on hover/tap */
  animated?: boolean;
  className?: string;
  /** accessible name; when omitted the coin is decorative (aria-hidden) */
  title?: string;
  /** comic sparkles around the coin (default true) */
  sparkles?: boolean;
}

const faceStyle: CSSProperties = {
  display: "block",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

/**
 * Comic-style Swiss "5 Räppli" coin. Static (server-renderable markup) unless `animated`.
 */
export function RappliCoin({ size = 48, animated = false, className, title, sparkles = true }: RappliCoinProps) {
  const reduced = useReducedMotion();
  const rotateY = useMotionValue(0);
  const spinning = useRef(false);

  if (!animated || reduced) {
    return <CoinArt size={size} className={className} title={title} sparkles={sparkles} />;
  }

  const flip = () => {
    if (spinning.current) return;
    spinning.current = true;
    animate(rotateY, rotateY.get() + 360, {
      type: "spring",
      stiffness: 170,
      damping: 12,
      mass: 0.9,
      onComplete: () => {
        spinning.current = false;
      },
    });
  };

  return (
    <motion.span
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "inline-block", width: size, height: size, cursor: "pointer" }}
      whileHover={{ scale: 1.06 }}
      onHoverStart={flip}
      onTap={flip}
    >
      <span className="block animate-coin-idle" style={{ width: size, height: size }}>
        <motion.span
          style={{
            display: "block",
            position: "relative",
            width: size,
            height: size,
            rotateY,
            transformPerspective: size * 5,
            transformStyle: "preserve-3d",
          }}
        >
          <span style={{ ...faceStyle, position: "relative" }}>
            <CoinArt size={size} sparkles={sparkles} style={{ display: "block" }} />
            <CoinShine />
          </span>
          {/* back face, pre-mirrored so the numeral reads correctly mid-flip */}
          <span style={{ ...faceStyle, position: "absolute", inset: 0, transform: "rotateY(180deg)" }}>
            <CoinArt size={size} sparkles={false} style={{ display: "block" }} />
          </span>
        </motion.span>
      </span>
    </motion.span>
  );
}

/**
 * Light sweep across the coin face. An HTML overlay clipped to the face circle (CoinArt's
 * face sits at (56, 55) r45 of its 120 viewBox) so the browser only moves a layer instead
 * of repainting the masked SVG every frame.
 */
function CoinShine() {
  return (
    <span
      className="pointer-events-none absolute overflow-hidden rounded-full"
      style={{ left: `${(11 / 120) * 100}%`, top: `${(10 / 120) * 100}%`, width: "75%", height: "75%" }}
    >
      <span className="absolute inset-0 animate-coin-shine">
        <span className="absolute inset-x-0 -top-1/4 -bottom-1/4 rotate-20">
          <span className="absolute inset-y-0 bg-white/55" style={{ left: "40%", width: "11%" }} />
          <span className="absolute inset-y-0 bg-white/45" style={{ left: "54.5%", width: "4%" }} />
        </span>
      </span>
    </span>
  );
}

export interface RappliLogoProps {
  size?: number;
  className?: string;
  /** white word mark for dark backgrounds */
  invert?: boolean;
}

/** Coin + "Räppli" word mark; the umlaut dots on the "ä" are tiny gold coins. */
export function RappliLogo({ size = 40, className, invert = false }: RappliLogoProps) {
  const ink = invert ? "#ffffff" : COIN_INK;
  const dot: CSSProperties = {
    position: "absolute",
    // line-height 1 + Bricolage metrics: x-height top sits ~0.3em below the box top
    top: "0.07em",
    width: "0.18em",
    height: "0.18em",
    marginLeft: "-0.09em",
    borderRadius: "999px",
    background: COIN_GOLD,
    boxShadow: invert ? undefined : `inset 0 0 0 0.035em ${COIN_INK}`,
  };

  return (
    <span
      className={["inline-flex items-center", className].filter(Boolean).join(" ")}
      style={{ gap: size * 0.18 }}
    >
      <CoinArt size={size} sparkles={false} />
      <span
        className="font-display font-extrabold tracking-tight"
        style={{ fontSize: size * 0.7, lineHeight: 1, color: ink }}
      >
        <span className="sr-only">Räppli</span>
        <span aria-hidden="true">
          R
          <span style={{ position: "relative", display: "inline-block" }}>
            a
            <span style={{ ...dot, left: "30%" }} />
            <span style={{ ...dot, left: "72%" }} />
          </span>
          ppli
        </span>
      </span>
    </span>
  );
}
