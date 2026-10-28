"use client";

import { useRef, type CSSProperties } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { CoinArt, COIN_GOLD, COIN_INK } from "./CoinArt";

export { CoinArt } from "./CoinArt";

export interface RappliCoinProps {
  size?: number;
  /** idle float/wobble + periodic shine sweep; playful 3D flip on hover/tap */
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
      animate={{ y: [0, -size * 0.06, 0], rotate: [-2.5, 2.5, -2.5] }}
      transition={{ duration: 4.2, ease: "easeInOut", repeat: Infinity }}
      whileHover={{ scale: 1.06 }}
      onHoverStart={flip}
      onTap={flip}
    >
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
        <CoinArt size={size} sparkles={sparkles} shine style={faceStyle} />
        {/* back face, pre-mirrored so the numeral reads correctly mid-flip */}
        <span style={{ ...faceStyle, position: "absolute", inset: 0, transform: "rotateY(180deg)" }}>
          <CoinArt size={size} sparkles={false} style={{ display: "block" }} />
        </span>
      </motion.span>
    </motion.span>
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
