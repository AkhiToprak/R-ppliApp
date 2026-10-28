"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CoinArt, COIN_DARK, COIN_INK, COIN_LIGHT, sparklePath } from "./CoinArt";

export interface CoinSpinnerProps {
  size?: number;
  /** accessible status text; shown under the coin when provided */
  label?: string;
}

const FLIP = 1.15; // seconds per full turn

const hidden: CSSProperties = {
  display: "block",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

const srOnly: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/** Loading indicator: the Räppli coin flipping around its Y axis with cartoon speed lines and sparkles. */
export function CoinSpinner({ size = 64, label }: CoinSpinnerProps) {
  const reduced = useReducedMotion();
  const box = size * 1.6;

  return (
    <span role="status" aria-live="polite" style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: size * 0.12 }}>
      <span aria-hidden="true" style={{ position: "relative", display: "block", width: box, height: box }}>
        {/* ground shadow, squashes as the coin hops */}
        <motion.span
          style={{
            position: "absolute",
            left: "50%",
            bottom: size * 0.06,
            width: size * 0.62,
            height: size * 0.09,
            marginLeft: -size * 0.31,
            borderRadius: "50%",
            background: COIN_INK,
            opacity: 0.14,
          }}
          animate={reduced ? undefined : { scaleX: [1, 0.7, 1], opacity: [0.16, 0.08, 0.16] }}
          transition={{ duration: FLIP, ease: "easeInOut", repeat: Infinity }}
        />

        {/* cartoon motion blur: speed arcs flash while the coin is edge-on */}
        {!reduced && (
          <motion.svg
            viewBox="0 0 160 160"
            width={box}
            height={box}
            style={{ position: "absolute", inset: 0 }}
            fill="none"
            stroke={COIN_INK}
            strokeLinecap="round"
            animate={{ opacity: [0, 0.9, 0, 0.9, 0] }}
            transition={{ duration: FLIP, ease: "linear", repeat: Infinity, times: [0, 0.32, 0.5, 0.68, 1] }}
          >
            <path d="M30 52C20 68 20 92 30 108" strokeWidth="4.5" />
            <path d="M18 64C13 74 13 86 18 96" strokeWidth="3.5" />
            <path d="M130 52C140 68 140 92 130 108" strokeWidth="4.5" />
            <path d="M142 64C147 74 147 86 142 96" strokeWidth="3.5" />
          </motion.svg>
        )}

        {/* the coin: hop + flip, two faces so the numeral never reads mirrored */}
        <motion.span
          style={{ position: "absolute", left: (box - size) / 2, top: (box - size) / 2 - size * 0.04, width: size, height: size }}
          animate={reduced ? { opacity: [1, 0.6, 1] } : { y: [0, -size * 0.1, 0] }}
          transition={{ duration: reduced ? 1.6 : FLIP, ease: "easeInOut", repeat: Infinity }}
        >
          <motion.span
            style={{
              display: "block",
              position: "relative",
              width: size,
              height: size,
              transformPerspective: size * 4,
              transformStyle: "preserve-3d",
            }}
            animate={reduced ? undefined : { rotateY: [0, 360] }}
            transition={{ duration: FLIP, ease: [0.45, 0.05, 0.55, 0.95], repeat: Infinity }}
          >
            <CoinArt size={size} sparkles={false} style={hidden} />
            <span style={{ ...hidden, position: "absolute", inset: 0, transform: "rotateY(180deg)" }}>
              <CoinArt size={size} sparkles={false} style={{ display: "block" }} />
            </span>
            {/* the coin's rim, visible as a gold slab when edge-on */}
            <span
              style={{
                position: "absolute",
                left: size * 0.467 - size * 0.04,
                top: size * 0.08,
                width: size * 0.08,
                height: size * 0.76,
                borderRadius: size * 0.04,
                background: `repeating-linear-gradient(180deg, ${COIN_DARK} 0 ${size * 0.03}px, #c99000 ${size * 0.03}px ${size * 0.05}px)`,
                boxShadow: `0 0 0 ${Math.max(1.5, size * 0.025)}px ${COIN_INK}`,
                transform: "rotateY(90deg)",
              }}
            />
          </motion.span>
        </motion.span>

        {/* twinkling sparkles */}
        <svg viewBox="0 0 160 160" width={box} height={box} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {[
            { x: 128, y: 30, s: 11, d: 0, fill: "#fff" },
            { x: 30, y: 122, s: 8, d: FLIP * 0.5, fill: COIN_LIGHT },
            { x: 140, y: 112, s: 6, d: FLIP * 0.25, fill: COIN_LIGHT },
          ].map((p) => (
            <motion.path
              key={`${p.x}-${p.y}`}
              d={sparklePath(p.x, p.y, p.s)}
              fill={p.fill}
              stroke={COIN_INK}
              strokeWidth="2.4"
              strokeLinejoin="round"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={{ scale: reduced ? 1 : 0, rotate: 0 }}
              animate={reduced ? undefined : { scale: [0, 1, 0], rotate: [0, 90] }}
              transition={{ duration: FLIP, delay: p.d, ease: "easeInOut", repeat: Infinity, repeatDelay: FLIP * 0.5 }}
            />
          ))}
        </svg>
      </span>
      {label ? (
        <span style={{ fontSize: Math.max(12, size * 0.2), fontWeight: 600 }}>{label}</span>
      ) : (
        <span style={srOnly}>Loading…</span>
      )}
    </span>
  );
}
