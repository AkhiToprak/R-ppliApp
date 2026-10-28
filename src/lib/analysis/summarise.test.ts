import { describe, expect, it } from "vitest";
import { analyse, summariseForLLM } from "./index";
import { addDays, tx } from "./fixtures";

describe("summariseForLLM", () => {
  const rows = [
    ...Array.from({ length: 16 }, (_, i) => tx(addDays("2025-01-01", i * 31), -(100 + i), "shopping", `Shop ${i}`)),
    tx("2026-05-01", -900, "shopping", undefined, { description: "Big purchase CH9300762011623852957 ref 123456789" }),
    tx("2026-05-02", -800, "leisure", "Concert Hall", { description: "Raw text with IBAN" }),
  ];
  const full = analyse(rows);
  const light = summariseForLLM(full);

  it("caps lists and keeps most recent months", () => {
    expect(full.byMonth.length).toBeGreaterThan(12);
    expect(light.byMonth).toHaveLength(12);
    expect(light.byMonth.at(-1)?.month).toBe(full.byMonth.at(-1)?.month);
    expect(light.topMerchants.length).toBeLessThanOrEqual(10);
    expect(light.largestExpenses).toHaveLength(5);
  });

  it("caps recurring at 15", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      ["2026-01-05", "2026-02-05", "2026-03-05"].map((d) => tx(d, -(10 + i * 3), "subscriptions", `Sub ${String.fromCharCode(65 + i)}`)),
    ).flat();
    const a = analyse(many);
    expect(a.recurring).toHaveLength(20);
    expect(summariseForLLM(a).recurring).toHaveLength(15);
  });

  it("strips ids and swaps description for counterparty", () => {
    const concert = light.largestExpenses.find((t) => t.counterparty === "Concert Hall");
    expect(concert?.description).toBe("Concert Hall");
    expect(light.largestExpenses.every((t) => t.id === "")).toBe(true);
  });

  it("scrubs long digit runs from descriptions without counterparty", () => {
    const big = light.largestExpenses.find((t) => t.amount === -900);
    expect(big?.description).not.toMatch(/\d{5,}/);
  });

  it("keeps aggregates and does not mutate the original", () => {
    expect(light.totalSpending).toBe(full.totalSpending);
    expect(light.byCategory).toEqual(full.byCategory);
    expect(full.largestExpenses[0].id).not.toBe("");
    expect(full.byMonth.length).toBeGreaterThan(12);
  });
});
