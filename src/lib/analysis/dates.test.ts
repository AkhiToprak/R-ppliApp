import { describe, expect, it } from "vitest";
import { dayNumber, monthRange, parseISODate, weekdayIndex } from "./dates";

const wd = (s: string) => weekdayIndex(dayNumber(parseISODate(s)!));

describe("dates", () => {
  it("maps known dates to weekdays (Monday = 0)", () => {
    expect(wd("2026-10-26")).toBe(0);
    expect(wd("2026-10-27")).toBe(1);
    expect(wd("2026-11-01")).toBe(6);
    expect(wd("1970-01-01")).toBe(3); // Thursday
    expect(wd("1969-12-31")).toBe(2); // before epoch
    expect(wd("2024-02-29")).toBe(3); // Thursday, leap day
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("2026-1-5")).toBeNull();
    expect(parseISODate("2026-01-05T10:00:00")).toBeNull();
    expect(parseISODate("")).toBeNull();
  });

  it("builds inclusive month ranges", () => {
    expect(monthRange("2026-11", "2027-01")).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(monthRange("2026-05", "2026-05")).toEqual(["2026-05"]);
  });
});
