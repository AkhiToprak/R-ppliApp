// CONTRACT (owned by the logo agent): comic-style Swiss 5-Rappen coin, inline SVG.
export interface RappliCoinProps {
  size?: number;
  /** idle wobble/shine animation */
  animated?: boolean;
  className?: string;
  title?: string;
}

export function RappliCoin({ size = 48, className }: RappliCoinProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="46" fill="#f2b705" stroke="#0b0b0f" strokeWidth="5" />
      <text x="50" y="64" textAnchor="middle" fontSize="40" fontWeight="900" fill="#0b0b0f">5</text>
    </svg>
  );
}

// CONTRACT: word mark "Räppli" next to the coin.
export function RappliLogo({ size = 40, className }: { size?: number; className?: string; invert?: boolean }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <RappliCoin size={size} />
      <span style={{ fontWeight: 800, fontSize: size * 0.6 }}>Räppli</span>
    </span>
  );
}
