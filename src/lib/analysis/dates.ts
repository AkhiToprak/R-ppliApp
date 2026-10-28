// Timezone-free date helpers. Dates are plain YYYY-MM-DD strings and are never
// passed through the local-time Date parser; UTC arithmetic is used for day maths.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export interface YMD {
  y: number;
  m: number;
  d: number;
}

/** Parses a strict YYYY-MM-DD string; returns null for malformed or impossible dates. */
export function parseISODate(s: string): YMD | null {
  const match = ISO_DATE.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

/** Days since 1970-01-01 (UTC). */
export function dayNumber({ y, m, d }: YMD): number {
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Weekday index for a day number, 0 = Monday ... 6 = Sunday. (1970-01-01 was a Thursday.) */
export function weekdayIndex(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

/** All YYYY-MM keys from `from` to `to` inclusive (both YYYY-MM). */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
