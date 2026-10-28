"use client";

import { useId, type CSSProperties } from "react";
import { motion } from "motion/react";

/*
 * Hand-inked comic "5 Räppli" coin — pure inline SVG, no fonts, no images.
 * Geometry is computed once at module load; every gradient/mask/pattern id
 * is namespaced with React's useId so many coins can share a page.
 */

export const COIN_INK = "#0b0b0f";
export const COIN_GOLD = "#f2b705";
export const COIN_LIGHT = "#ffd84d";
export const COIN_DARK = "#b07d00";

const INK = COIN_INK;
const GOLD = COIN_GOLD;
const LIGHT = COIN_LIGHT;
const DARK = COIN_DARK;

/** Face radius, coin thickness (extrusion vector) and inner-ring radius, in the coin's local frame. */
const R = 45;
const OFF = { x: 3.5, y: 6.5 };
const RING = 36.8;
/** The whole coin sits at (CX, CY) of the 120×120 viewBox, tipped by TILT degrees. */
const CX = 56;
const CY = 55;
const TILT = -8;

const f = (n: number) => Math.round(n * 100) / 100;
const rad = (deg: number) => (deg * Math.PI) / 180;

function circlePath(cx: number, cy: number, r: number) {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

/** A brush-like ink ring whose weight swells from wMin to wMax towards `heavyDeg`. */
function inkRing(cx: number, cy: number, r: number, wMin: number, wMax: number, heavyDeg: number) {
  const a = (wMax + wMin) / 4;
  const d = (wMax - wMin) / 2;
  const ux = Math.cos(rad(heavyDeg));
  const uy = Math.sin(rad(heavyDeg));
  return circlePath(cx + d * ux, cy + d * uy, r + a) + circlePath(cx, cy, r - a);
}

/** Comic four-point sparkle. */
export function sparklePath(cx: number, cy: number, s: number, k = 0.2) {
  const q = k * s;
  return (
    `M${f(cx)} ${f(cy - s)}` +
    `Q${f(cx + q)} ${f(cy - q)} ${f(cx + s)} ${f(cy)}` +
    `Q${f(cx + q)} ${f(cy + q)} ${f(cx)} ${f(cy + s)}` +
    `Q${f(cx - q)} ${f(cy + q)} ${f(cx - s)} ${f(cy)}` +
    `Q${f(cx - q)} ${f(cy - q)} ${f(cx)} ${f(cy - s)}Z`
  );
}

/* ---------- "HELVETIA" — monoline heavy caps bent along the top arc ---------- */

type Glyph = { w: number; strokes: [number, number][][] };
const GLYPHS: Record<string, Glyph> = {
  H: { w: 0.62, strokes: [[[0, 0], [0, 1]], [[0.62, 0], [0.62, 1]], [[0, 0.5], [0.62, 0.5]]] },
  E: { w: 0.5, strokes: [[[0.5, 0], [0, 0], [0, 1], [0.5, 1]], [[0, 0.5], [0.42, 0.5]]] },
  L: { w: 0.46, strokes: [[[0, 0], [0, 1], [0.46, 1]]] },
  V: { w: 0.66, strokes: [[[0, 0], [0.33, 1], [0.66, 0]]] },
  T: { w: 0.6, strokes: [[[0, 0], [0.6, 0]], [[0.3, 0], [0.3, 1]]] },
  I: { w: 0, strokes: [[[0, 0], [0, 1]]] },
  A: { w: 0.68, strokes: [[[0, 1], [0.34, 0], [0.68, 1]], [[0.15, 0.64], [0.53, 0.64]]] },
};

const LETTER_H = 5.4;
const LETTER_STROKE = 1.75;
const LETTER_BASE_R = 27.6;

function arcLettering(word: string) {
  const h = LETTER_H;
  const gap = LETTER_STROKE + 1.55;
  const glyphs = [...word].map((c) => GLYPHS[c]);
  const total = glyphs.reduce((s, g) => s + g.w * h, 0) + gap * (glyphs.length - 1);
  let cursor = -total / 2;
  let d = "";
  for (const g of glyphs) {
    for (const stroke of g.strokes) {
      stroke.forEach(([u, v], i) => {
        const s = cursor + u * h; // arc length along the baseline
        const r = LETTER_BASE_R + (1 - v) * h; // height above baseline
        const phi = s / LETTER_BASE_R;
        d += `${i === 0 ? "M" : "L"}${f(r * Math.sin(phi))} ${f(-r * Math.cos(phi))}`;
      });
    }
    cursor += g.w * h + gap;
  }
  return d;
}

const HELVETIA = arcLettering("HELVETIA");

/* ---------- The chunky numeral ---------- */

export const FIVE_PATH =
  "M6 0L29 0L29 9.5L14.6 9.5L14 15.9C15.9 15.2 17.8 15 19.8 15C27.2 15 31.6 20.6 31.6 29.6C31.6 39.6 25 46 15 46" +
  "C8.2 46 3 42.6 0.4 37L9 33C10.3 35.8 12.4 37.1 15 37.1C19 37.1 21.6 34.1 21.6 29.7C21.6 25.2 19 22.6 15.5 22.6" +
  "C12.6 22.6 10.6 23.8 9.5 25.6L2.4 23.6Z";
const FIVE_SHINE = "M8 3.1L20.5 3.1M22.3 18.5C25.3 19.2 27.6 21.5 28.4 25";
const FIVE_POS = { x: -15.3, y: -18 };
const FIVE_DEPTH = { x: 1.7, y: 2.5 };

/* ---------- Precomputed shapes ---------- */

const EDGE_TICKS = (() => {
  let d = "";
  for (let deg = -24; deg <= 148; deg += 7.5) {
    const x = R * Math.cos(rad(deg));
    const y = R * Math.sin(rad(deg));
    d += `M${f(x)} ${f(y)}l${OFF.x + 1} ${OFF.y + 1}`;
  }
  return d;
})();

const EDGE_OUTLINE = inkRing(OFF.x, OFF.y, R, 2.6, 4.6, 62);

/** The coin's side: the face circle swept along OFF (circle ∪ tangent band ∪ offset circle). */
const EDGE_ANGLE = Math.atan2(OFF.y, OFF.x);
const EDGE_SHAPE = (() => {
  const a = EDGE_ANGLE - Math.PI / 2;
  const b = EDGE_ANGLE + Math.PI / 2;
  const pt = (t: number, dx = 0, dy = 0) => `${f(R * Math.cos(t) + dx)} ${f(R * Math.sin(t) + dy)}`;
  return `M${pt(a)}L${pt(a, OFF.x, OFF.y)}A${R} ${R} 0 0 1 ${pt(b, OFF.x, OFF.y)}L${pt(b)}A${R} ${R} 0 0 0 ${pt(a)}Z`;
})();
const EDGE_SIDES = (() => {
  const pts = [EDGE_ANGLE - Math.PI / 2, EDGE_ANGLE + Math.PI / 2].map((t) => [R * Math.cos(t), R * Math.sin(t)]);
  return pts.map(([x, y]) => `M${f(x)} ${f(y)}l${OFF.x} ${OFF.y}`).join("");
})();
const FACE_OUTLINE = inkRing(0, 0, R, 2.3, 3.5, 225);
const RING_OUTLINE = inkRing(0, 0, RING, 1.4, 2.6, 50);

function arcPath(r: number, fromDeg: number, toDeg: number) {
  const a = rad(fromDeg);
  const b = rad(toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M${f(r * Math.cos(a))} ${f(r * Math.sin(a))}A${r} ${r} 0 ${large} 1 ${f(r * Math.cos(b))} ${f(r * Math.sin(b))}`;
}

const RIM_SHINE = arcPath(41, 196, 246);
const RIM_SHINE_DOT = arcPath(41, 256, 263);

export interface CoinArtProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** comic sparkles floating around the coin */
  sparkles?: boolean;
  /** animated light sweep across the face (client-side, motion) */
  shine?: boolean;
}

export function CoinArt({ size = 48, className, style, title, sparkles = true, shine = false }: CoinArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `rp-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={id("face")}>
          <circle r={R} />
        </clipPath>
        <clipPath id={id("edge")}>
          <path d={EDGE_SHAPE} />
        </clipPath>
        {/* graded halftone: small dots fade into big dots towards the shadow edge */}
        <pattern id={id("dots-s")} width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="1.7" cy="1.7" r="0.62" fill={DARK} />
        </pattern>
        <pattern id={id("dots-l")} width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="1.7" cy="1.7" r="1.12" fill={DARK} />
        </pattern>
        {[
          ["shade-1", 3.6],
          ["shade-2", 8.5],
          ["shade-3", 14.5],
        ].map(([name, o]) => (
          <mask key={name} id={id(String(name))} maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120">
            <circle r={R} fill="#fff" />
            <circle cx={-Number(o)} cy={-Number(o)} r={R} fill="#000" />
          </mask>
        ))}
        <mask id={id("recess")} maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120">
          <circle r={RING} fill="#fff" />
          <circle cx="2.8" cy="2.8" r={RING} fill="#000" />
        </mask>
        <mask id={id("wall")} maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120">
          <circle r={RING} fill="#fff" />
          <circle cx="-2.4" cy="-2.4" r={RING} fill="#000" />
        </mask>
      </defs>

      <g transform={`translate(${CX} ${CY}) rotate(${TILT})`}>
        {/* coin thickness: reeded edge band */}
        <path d={EDGE_SHAPE} fill={DARK} />
        <g clipPath={url("edge")}>
          <path d={EDGE_TICKS} stroke={INK} strokeOpacity="0.5" strokeWidth="1.25" strokeLinecap="round" fill="none" />
        </g>
        <path d={EDGE_OUTLINE} fill={INK} fillRule="evenodd" />
        <path d={EDGE_SIDES} stroke={INK} strokeWidth="2.8" strokeLinecap="round" />

        {/* face with cel shading */}
        <circle r={R} fill={LIGHT} />
        <g clipPath={url("face")}>
          <circle cx="5.6" cy="5.6" r={R} fill={GOLD} />
          <rect x="-50" y="-50" width="100" height="100" fill={url("dots-s")} mask={url("shade-3")} />
          <rect x="-50" y="-50" width="100" height="100" fill={url("dots-l")} mask={url("shade-2")} />
          <rect x="-50" y="-50" width="100" height="100" fill={DARK} mask={url("shade-1")} />
          {/* recessed field: rim casts a shadow top-left, inner wall catches light bottom-right */}
          <rect x="-50" y="-50" width="100" height="100" fill={DARK} fillOpacity="0.9" mask={url("recess")} />
          <rect x="-50" y="-50" width="100" height="100" fill={LIGHT} mask={url("wall")} />
        </g>
        <path d={RING_OUTLINE} fill={INK} fillRule="evenodd" />
        <path d={FACE_OUTLINE} fill={INK} fillRule="evenodd" />

        {/* HELVETIA */}
        <path
          d={HELVETIA}
          fill="none"
          stroke={INK}
          strokeWidth={LETTER_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* tiny struck stars flanking the numeral */}
        <path d={sparklePath(-25, 9, 2.9, 0.3) + sparklePath(26.5, 9.5, 2.9, 0.3)} fill={INK} />

        {/* the big embossed 5 */}
        <g transform={`translate(${FIVE_POS.x} ${FIVE_POS.y})`} strokeLinejoin="round">
          <path
            d={FIVE_PATH}
            transform={`translate(${FIVE_DEPTH.x} ${FIVE_DEPTH.y})`}
            fill={DARK}
            stroke={INK}
            strokeWidth="2.3"
          />
          <path d={FIVE_PATH} fill={LIGHT} stroke={INK} strokeWidth="2.3" />
          <path d={FIVE_SHINE} fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* crisp highlight crescent + glint on the rim */}
        <path d={RIM_SHINE} fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        <path d={RIM_SHINE_DOT} fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />

        {shine ? (
          <g clipPath={url("face")}>
            <motion.g
              initial={{ x: -95 }}
              animate={{ x: 95 }}
              transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.4, delay: 1.2 }}
            >
              <g transform="rotate(28)" fill="#fff">
                <rect x="-9" y="-70" width="10" height="140" fillOpacity="0.55" />
                <rect x="4" y="-70" width="3.5" height="140" fillOpacity="0.45" />
              </g>
            </motion.g>
          </g>
        ) : null}
      </g>

      {/* glint star sitting on the highlight */}
      <path d={sparklePath(25, 27, 6.5, 0.16)} fill="#fff" />

      {sparkles ? (
        <g stroke={INK} strokeWidth="1.8" strokeLinejoin="round">
          <path d={sparklePath(104, 16, 10)} fill="#fff" />
          <path d={sparklePath(114.5, 35, 4.6)} fill={LIGHT} />
          <path d={sparklePath(11, 101, 5.6)} fill={LIGHT} />
        </g>
      ) : null}
    </svg>
  );
}
