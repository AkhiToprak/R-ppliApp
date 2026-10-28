import { describe, expect, it } from "vitest";
import { getSampleStatement } from "./index";

describe("getSampleStatement", () => {
  const s = getSampleStatement();

  it("is a realistic 3-month CHF statement", () => {
    expect(s.format).toBe("sample");
    expect(s.bank).toBe("Räppli Demo");
    expect(s.currency).toBe("CHF");
    expect(s.transactions.length).toBeGreaterThanOrEqual(110);
    expect(s.transactions.length).toBeLessThanOrEqual(150);
    expect(s.transactions[0].date >= "2026-07-01").toBe(true);
    expect(s.transactions[s.transactions.length - 1].date <= "2026-09-30").toBe(true);
    const dates = s.transactions.map((t) => t.date);
    expect([...dates].sort()).toEqual(dates);
    expect(s.transactions.filter((t) => t.amount === 6800)).toHaveLength(3);
    expect(s.transactions.filter((t) => t.amount === -2150)).toHaveLength(3);
    expect(new Set(s.transactions.map((t) => t.id)).size).toBe(s.transactions.length);
    expect(s.warnings).toEqual([]);
  });

  it("is deterministic", () => {
    expect(getSampleStatement()).toEqual(s);
  });

  it("contains merchants a rule list would not know", () => {
    const names = s.transactions.map((t) => t.counterparty);
    for (const n of ["Bäckerei Hug Luzern", "Kafi Dihei", "Brockenhaus Zürich", "Velo Lade Wipkingen"]) {
      expect(names).toContain(n);
    }
  });
});
