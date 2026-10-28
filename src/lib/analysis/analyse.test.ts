import { describe, expect, it } from "vitest";
import { analyse } from "./index";
import { tx } from "./fixtures";

describe("analyse: totals", () => {
  const data = [
    tx("2026-01-01", 5000, "income", "Employer AG"),
    tx("2026-01-05", -1500, "housing", "Landlord"),
    tx("2026-01-10", -200, "groceries", "Migros"),
    tx("2026-01-12", 50, "groceries", "Migros"), // refund
    tx("2026-01-20", -1000, "savings", "Saving plan"),
    tx("2026-01-25", -300, "transfers", "Own account"),
    tx("2026-01-31", -100, "restaurants", "Restaurant X"),
  ];
  const a = analyse(data);

  it("computes income, spending, saved and net", () => {
    expect(a.totalIncome).toBe(5000);
    expect(a.totalSpending).toBe(1500 + 150 + 100);
    expect(a.totalSaved).toBe(1000);
    expect(a.net).toBe(5000 - 1750 - 1000);
    expect(a.transactionCount).toBe(7);
  });

  it("reduces category spending by refunds", () => {
    const groceries = a.byCategory.find((c) => c.category === "groceries");
    expect(groceries?.total).toBe(150);
    expect(groceries?.count).toBe(2);
  });

  it("floors refund-only categories at zero and omits them", () => {
    const r = analyse([tx("2026-01-01", 80, "shopping", "Zalando"), tx("2026-01-02", -10, "fees")]);
    expect(r.byCategory.find((c) => c.category === "shopping")).toBeUndefined();
    expect(r.totalSpending).toBe(10);
  });

  it("keeps transfers/savings/income in byCategory but out of spending and shares", () => {
    const cats = a.byCategory.map((c) => c.category);
    expect(cats).toEqual(expect.arrayContaining(["income", "savings", "transfers"]));
    const transfers = a.byCategory.find((c) => c.category === "transfers");
    expect(transfers?.total).toBe(300);
    expect(transfers?.share).toBe(0);
    const shareSum = a.byCategory.reduce((s, c) => s + c.share, 0);
    expect(shareSum).toBeCloseTo(1, 3);
  });

  it("sorts byCategory descending by total", () => {
    const totals = a.byCategory.map((c) => c.total);
    expect(totals).toEqual([...totals].sort((x, y) => y - x));
  });

  it("computes savings rate", () => {
    expect(a.savingsRate).toBeCloseTo((5000 - 1750) / 5000, 4);
  });

  it("clamps savings rate to [-1, 1]", () => {
    const r = analyse([tx("2026-01-01", 100, "income"), tx("2026-01-02", -900, "shopping")]);
    expect(r.savingsRate).toBe(-1);
  });

  it("returns null savings rate without income", () => {
    expect(analyse([tx("2026-01-02", -90, "shopping")]).savingsRate).toBeNull();
  });

  it("treats positive uncategorised / other inflows as income", () => {
    const r = analyse([tx("2026-01-01", 120), tx("2026-01-02", 30, "other"), tx("2026-01-03", -20)]);
    expect(r.totalIncome).toBe(150);
    expect(r.byCategory.find((c) => c.category === "income")?.total).toBe(150);
    // missing category on an outflow counts as "other" spending
    expect(r.byCategory.find((c) => c.category === "other")?.total).toBe(20);
  });
});

describe("analyse: period and averages", () => {
  it("derives period, fractional months and averages", () => {
    const a = analyse([tx("2026-01-01", -100, "shopping"), tx("2026-03-31", -200, "shopping")]);
    expect(a.period).toEqual({ from: "2026-01-01", to: "2026-03-31" });
    const days = 31 + 28 + 31;
    expect(a.months).toBeCloseTo(days / 30.44, 2);
    expect(a.dailyAverageSpending).toBeCloseTo(300 / days, 2);
    expect(a.byCategory[0].monthlyAverage).toBeCloseTo(300 / (days / 30.44), 1);
  });

  it("uses at least one month and one day", () => {
    const a = analyse([tx("2026-05-05", -30, "leisure")]);
    expect(a.months).toBe(1);
    expect(a.dailyAverageSpending).toBe(30);
  });

  it("is independent of input order", () => {
    const rows = [
      tx("2026-02-03", -10, "leisure", "A"),
      tx("2026-01-03", -20, "leisure", "B"),
      tx("2026-03-03", -30, "leisure", "C"),
    ];
    expect(analyse([...rows].reverse())).toEqual(analyse(rows));
  });
});

describe("analyse: byMonth", () => {
  it("fills gap months with zeros and keeps chronological order", () => {
    const a = analyse([
      tx("2026-01-15", 3000, "income"),
      tx("2026-01-20", -100, "groceries", "Coop"),
      tx("2026-04-02", -50, "leisure", "Cinema"),
      tx("2026-04-03", -500, "savings"),
    ]);
    expect(a.byMonth.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(a.byMonth[0]).toMatchObject({ income: 3000, spending: 100, saved: 0 });
    expect(a.byMonth[0].byCategory).toEqual({ groceries: 100 });
    expect(a.byMonth[1]).toEqual({ month: "2026-02", income: 0, spending: 0, saved: 0, byCategory: {} });
    expect(a.byMonth[3]).toMatchObject({ income: 0, spending: 50, saved: 500 });
  });

  it("spans year boundaries", () => {
    const a = analyse([tx("2025-11-30", -1, "fees"), tx("2026-02-01", -1, "fees")]);
    expect(a.byMonth.map((m) => m.month)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("analyse: weekdays", () => {
  it("maps 2026-10-26 to Monday (index 0) and 2026-11-01 to Sunday (6)", () => {
    const a = analyse([
      tx("2026-10-26", -10, "shopping"), // Monday
      tx("2026-10-28", -20, "shopping"), // Wednesday
      tx("2026-11-01", -40, "shopping"), // Sunday
    ]);
    expect(a.weekdaySpending).toEqual([10, 0, 20, 0, 0, 0, 40]);
  });

  it("ignores non-spending categories", () => {
    const a = analyse([tx("2026-10-26", 100, "income"), tx("2026-10-27", -50, "savings")]);
    expect(a.weekdaySpending).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("analyse: merchants and largest expenses", () => {
  const rows = [
    tx("2026-01-01", -50, "groceries", "Migros"),
    tx("2026-01-02", -30, "groceries", "MIGROS"),
    tx("2026-01-03", -20, "groceries", "Migros"),
    tx("2026-01-04", -60, "shopping", "Zalando"),
    tx("2026-01-05", -1000, "savings", "Saving"),
    tx("2026-01-06", -999, "transfers", "Me"),
    tx("2026-01-07", -75, "leisure", undefined, { description: "Kino Pathé 123456 Zürich" }),
    tx("2026-01-08", -75, "leisure", undefined, { description: "Kino Pathé 987 Zürich" }),
  ];
  const a = analyse(rows);

  it("groups by normalised counterparty with most common spelling", () => {
    expect(a.topMerchants[0].name).toBe("Kino Pathé Zürich"); // sorted desc by total
    expect(a.topMerchants.find((m) => m.name === "Migros")).toEqual({ name: "Migros", total: 100, count: 3, category: "groceries" });
  });

  it("falls back to the description cleaned of digits", () => {
    const kino = a.topMerchants.find((m) => m.total === 150);
    expect(kino).toBeDefined();
    expect(kino?.count).toBe(2);
    expect(kino?.name).toBe("Kino Pathé Zürich");
  });

  it("excludes savings and transfers and caps at 10", () => {
    expect(a.topMerchants.find((m) => m.name === "Saving" || m.name === "Me")).toBeUndefined();
    const many = Array.from({ length: 15 }, (_, i) => tx("2026-01-01", -(i + 1), "shopping", `Shop ${String.fromCharCode(65 + i)}`));
    expect(analyse(many).topMerchants).toHaveLength(10);
  });

  it("lists the 5 largest spending outflows, excluding savings/transfers", () => {
    expect(a.largestExpenses).toHaveLength(5);
    expect(a.largestExpenses.map((t) => t.amount)).toEqual([-75, -75, -60, -50, -30]);
    expect(a.largestExpenses.every((t) => t.category !== "savings" && t.category !== "transfers")).toBe(true);
  });
});

describe("analyse: edge cases", () => {
  it("returns a zeroed analysis for empty input", () => {
    const a = analyse([]);
    expect(a.currency).toBe("CHF");
    expect(a.period).toEqual({ from: "", to: "" });
    expect(a.months).toBe(1);
    expect(a.totalIncome).toBe(0);
    expect(a.totalSpending).toBe(0);
    expect(a.totalSaved).toBe(0);
    expect(a.net).toBe(0);
    expect(a.savingsRate).toBeNull();
    expect(a.dailyAverageSpending).toBe(0);
    expect(a.byCategory).toEqual([]);
    expect(a.byMonth).toEqual([]);
    expect(a.topMerchants).toEqual([]);
    expect(a.recurring).toEqual([]);
    expect(a.largestExpenses).toEqual([]);
    expect(a.weekdaySpending).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(a.transactionCount).toBe(0);
  });

  it("picks the most common currency", () => {
    const a = analyse([
      tx("2026-01-01", -1, "fees", undefined, { currency: "EUR" }),
      tx("2026-01-02", -1, "fees", undefined, { currency: "CHF" }),
      tx("2026-01-03", -1, "fees", undefined, { currency: "EUR" }),
    ]);
    expect(a.currency).toBe("EUR");
  });

  it("skips rows with invalid dates", () => {
    const a = analyse([tx("2026-13-40", -5, "fees"), tx("not a date", -5, "fees"), tx("2026-01-01", -7, "fees")]);
    expect(a.totalSpending).toBe(7);
    expect(a.transactionCount).toBe(1);
  });

  it("does not mutate its input", () => {
    const rows = [tx("2026-01-02", -5, "fees"), tx("2026-01-01", 5, "income")];
    const copy = JSON.parse(JSON.stringify(rows));
    analyse(rows);
    expect(rows).toEqual(copy);
  });
});

describe("analyse: rounding", () => {
  it("rounds only at the end to 2 decimals", () => {
    const rows = Array.from({ length: 10 }, (_, i) => tx(`2026-01-${String(i + 1).padStart(2, "0")}`, -0.1, "fees"));
    const a = analyse(rows);
    expect(a.totalSpending).toBe(1); // 10 x 0.1 accumulates float error before rounding
    expect(a.byCategory[0].total).toBe(1);
  });

  it("rounds every amount field to at most 2 decimals", () => {
    const a = analyse([
      tx("2026-01-01", 3333.333, "income"),
      tx("2026-02-17", -12.3456, "groceries", "Coop"),
      tx("2026-03-09", -7.777, "leisure", "Cinema"),
    ]);
    const isRounded = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9;
    const numbers = [
      a.months,
      a.totalIncome,
      a.totalSpending,
      a.totalSaved,
      a.net,
      a.dailyAverageSpending,
      ...a.byCategory.flatMap((c) => [c.total, c.monthlyAverage]),
      ...a.byMonth.flatMap((m) => [m.income, m.spending, m.saved]),
      ...a.weekdaySpending,
    ];
    expect(numbers.every(isRounded)).toBe(true);
    expect(a.totalSpending).toBe(20.12);
  });
});
