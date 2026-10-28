import { describe, expect, it } from "vitest";
import { analyse } from "./index";
import { addDays, tx } from "./fixtures";

describe("recurring detection", () => {
  it("detects a monthly Netflix subscription", () => {
    const rows = [
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
      "2026-06-15",
    ].map((d) => tx(d, -17.9, "subscriptions", "Netflix"));
    const { recurring } = analyse(rows);
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toEqual({
      name: "Netflix",
      category: "subscriptions",
      amount: 17.9,
      frequency: "monthly",
      monthlyCost: 17.9,
      occurrences: 6,
    });
  });

  it("tolerates small amount changes and uneven month lengths", () => {
    const rows = [
      tx("2026-01-31", -29.9, "telecom", "Swisscom"),
      tx("2026-02-28", -29.9, "telecom", "swisscom"),
      tx("2026-03-31", -32.5, "telecom", "Swisscom"),
      tx("2026-04-30", -29.9, "telecom", "Swisscom"),
    ];
    const { recurring } = analyse(rows);
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({ frequency: "monthly", occurrences: 4, amount: 29.9 });
  });

  it("detects a weekly gym class with x4.33 normalisation", () => {
    const rows = [0, 7, 14, 21, 28].map((n) => tx(addDays("2026-09-01", n), -25, "leisure", "Yoga Studio"));
    const { recurring } = analyse(rows);
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({ frequency: "weekly", amount: 25, occurrences: 5 });
    expect(recurring[0].monthlyCost).toBeCloseTo(108.25, 2);
  });

  it("requires at least 3 occurrences for weekly", () => {
    const rows = [0, 7].map((n) => tx(addDays("2026-09-01", n), -25, "leisure", "Yoga Studio"));
    expect(analyse(rows).recurring).toEqual([]);
  });

  it("detects a yearly insurance with 2 occurrences, normalised /12", () => {
    const rows = [tx("2025-03-01", -1200, "insurance", "Helvetia"), tx("2026-03-01", -1200, "insurance", "Helvetia")];
    const { recurring } = analyse(rows);
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({ frequency: "yearly", amount: 1200, monthlyCost: 100, occurrences: 2 });
  });

  it("detects quarterly payments with /3 normalisation", () => {
    const rows = ["2026-01-10", "2026-04-10", "2026-07-09", "2026-10-09"].map((d) => tx(d, -300, "insurance", "Zurich"));
    const { recurring } = analyse(rows);
    expect(recurring[0]).toMatchObject({ frequency: "quarterly", monthlyCost: 100, occurrences: 4 });
  });

  it("does not flag irregular grocery-style shopping", () => {
    const offsets = [0, 2, 7, 9, 21, 22, 40, 41, 55];
    const amounts = [23.4, 87.2, 41.9, 15.6, 63.1, 120.5, 250, 5.2, 33.0];
    const groceries = offsets.map((n, i) => tx(addDays("2026-01-01", n), -amounts[i], "groceries", "Migros"));
    expect(analyse(groceries).recurring).toEqual([]);

    // same pattern in a category that is not excluded: irregular intervals and amounts
    const shopping = offsets.map((n, i) => tx(addDays("2026-01-01", n), -amounts[i], "shopping", "Migros"));
    expect(analyse(shopping).recurring).toEqual([]);
  });

  it("does not flag similar amounts at irregular intervals", () => {
    const rows = [0, 3, 19, 22, 50].map((n) => tx(addDays("2026-01-01", n), -20, "shopping", "Kiosk"));
    expect(analyse(rows).recurring).toEqual([]);
  });

  it("never flags groceries/restaurants even with a fixed cadence and amount", () => {
    const rows = [0, 7, 14, 21].map((n) => tx(addDays("2026-01-01", n), -80, "groceries", "Coop"));
    expect(analyse(rows).recurring).toEqual([]);
  });

  it("excludes income and transfers", () => {
    const salary = ["2026-01-25", "2026-02-25", "2026-03-25"].map((d) => tx(d, 6000, "income", "Employer"));
    const transfers = ["2026-01-02", "2026-02-02", "2026-03-02"].map((d) => tx(d, -500, "transfers", "Own"));
    expect(analyse([...salary, ...transfers]).recurring).toEqual([]);
  });

  it("includes rent and savings plans", () => {
    const rent = ["2026-01-01", "2026-02-01", "2026-03-01"].map((d) => tx(d, -1800, "housing", "Landlord"));
    const plan = ["2026-01-26", "2026-02-26", "2026-03-26"].map((d) => tx(d, -500, "savings", "Säule 3a"));
    const { recurring } = analyse([...rent, ...plan]);
    expect(recurring.map((r) => r.name)).toEqual(["Landlord", "Säule 3a"]);
  });

  it("separates different amount clusters of one merchant and sorts by monthly cost", () => {
    const music = ["2026-01-05", "2026-02-05", "2026-03-05"].map((d) => tx(d, -2.99, "subscriptions", "Apple"));
    const storage = ["2026-01-12", "2026-02-12", "2026-03-12"].map((d) => tx(d, -49.9, "subscriptions", "Apple"));
    const { recurring } = analyse([...music, ...storage]);
    expect(recurring.map((r) => r.amount)).toEqual([49.9, 2.99]);
  });

  it("matches merchants without counterparty by digit-stripped description", () => {
    const rows = ["2026-01-03", "2026-02-03", "2026-03-04"].map((d, i) =>
      tx(d, -9.9, "subscriptions", undefined, { description: `SPOTIFY P0${i}12345 STOCKHOLM` }),
    );
    const { recurring } = analyse(rows);
    expect(recurring).toHaveLength(1);
    expect(recurring[0].occurrences).toBe(3);
  });

  it("ignores a single occurrence", () => {
    expect(analyse([tx("2026-01-01", -10, "subscriptions", "Once")]).recurring).toEqual([]);
  });
});
