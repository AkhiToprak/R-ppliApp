"use client";

import { CoinSpinner } from "@/components/brand/CoinSpinner";

/**
 * The flipping Räppli coin. Every call site renders its own visible status text next to it,
 * so the spinner itself is decorative here.
 */
export function Spinner({ size = 64 }: { size?: number; label?: string }) {
  return (
    <span aria-hidden className="inline-grid place-items-center">
      <CoinSpinner size={size} />
    </span>
  );
}
