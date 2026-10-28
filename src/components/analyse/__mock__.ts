// Development-only fixtures for building the dashboard against realistic data while
// the parser / analysis / LLM modules are stubs. NOT imported by the real flow.
import type { Analysis, Insights, Transaction } from "@/lib/types";

const tx = (id: string, date: string, counterparty: string, amount: number, category: Transaction["category"]): Transaction => ({
  id,
  date,
  description: `${amount < 0 ? "Belastung" : "Gutschrift"} ${counterparty.toUpperCase()} ${date}`,
  counterparty,
  amount,
  currency: "CHF",
  category,
  categorySource: "rule",
});

export const mockTransactions: Transaction[] = [
  tx("m1", "2025-07-25", "Arbeitgeber AG", 6450, "income"),
  tx("m2", "2025-07-01", "Immobilien Verwaltung Zürich", -1890, "housing"),
  tx("m3", "2025-07-03", "Migros", -84.35, "groceries"),
  tx("m4", "2025-07-05", "Coop", -61.2, "groceries"),
  tx("m5", "2025-07-06", "SBB CFF FFS", -340, "transport"),
  tx("m6", "2025-07-08", "Netflix", -18.9, "subscriptions"),
  tx("m7", "2025-07-09", "Swisscom", -69, "telecom"),
  tx("m8", "2025-07-12", "Hiltl", -92.5, "restaurants"),
  tx("m9", "2025-07-15", "CSS Versicherung", -412.4, "insurance"),
  tx("m10", "2025-07-26", "Sparkonto", -800, "savings"),
  tx("m11", "2025-08-25", "Arbeitgeber AG", 6450, "income"),
  tx("m12", "2025-08-01", "Immobilien Verwaltung Zürich", -1890, "housing"),
  tx("m13", "2025-08-14", "Zalando", -189.9, "shopping"),
  tx("m14", "2025-08-16", "Edelweiss Air", -642, "travel"),
  tx("m15", "2025-09-25", "Arbeitgeber AG", 6450, "income"),
  tx("m16", "2025-09-01", "Immobilien Verwaltung Zürich", -1890, "housing"),
  tx("m17", "2025-09-20", "Denner", -38.6, "groceries"),
];

export const mockAnalysis: Analysis = {
  currency: "CHF",
  period: { from: "2025-07-01", to: "2025-09-30" },
  months: 3,
  totalIncome: 19350,
  totalSpending: 14210.6,
  totalSaved: 2400,
  net: 2739.4,
  savingsRate: 0.2656,
  dailyAverageSpending: 154.46,
  byCategory: [
    { category: "income", total: 19350, count: 3, share: 0, monthlyAverage: 6450, months: 3 },
    { category: "housing", total: 5670, count: 3, share: 0.399, monthlyAverage: 1890, months: 3 },
    { category: "groceries", total: 2135.4, count: 41, share: 0.15, monthlyAverage: 711.8, months: 3 },
    { category: "insurance", total: 1237.2, count: 3, share: 0.087, monthlyAverage: 412.4, months: 3 },
    { category: "restaurants", total: 1184.3, count: 23, share: 0.083, monthlyAverage: 394.77, months: 3 },
    { category: "transport", total: 1020, count: 6, share: 0.072, monthlyAverage: 340, months: 3 },
    { category: "travel", total: 942, count: 2, share: 0.066, monthlyAverage: 314, months: 1 },
    { category: "shopping", total: 731.8, count: 9, share: 0.051, monthlyAverage: 243.93, months: 3 },
    { category: "telecom", total: 207, count: 3, share: 0.015, monthlyAverage: 69, months: 3 },
    { category: "leisure", total: 512.4, count: 7, share: 0.036, monthlyAverage: 170.8, months: 3 },
    { category: "subscriptions", total: 136.5, count: 9, share: 0.0096, monthlyAverage: 45.5, months: 3 },
    { category: "fees", total: 24, count: 3, share: 0.0017, monthlyAverage: 8, months: 3 },
    { category: "health", total: 410, count: 2, share: 0.0289, monthlyAverage: 136.67, months: 2 },
    { category: "savings", total: 2400, count: 3, share: 0, monthlyAverage: 800, months: 3 },
  ],
  byMonth: [
    { month: "2025-07", income: 6450, spending: 4520.3, saved: 800, byCategory: { housing: 1890, groceries: 702.1 } },
    { month: "2025-08", income: 6450, spending: 5380.1, saved: 800, byCategory: { housing: 1890, travel: 942 } },
    { month: "2025-09", income: 6450, spending: 4310.2, saved: 800, byCategory: { housing: 1890, groceries: 690.4 } },
  ],
  topMerchants: [
    { name: "Immobilien Verwaltung Zürich", category: "housing", total: 5670, count: 3, months: 3 },
    { name: "Migros", category: "groceries", total: 1180.4, count: 22, months: 3 },
    { name: "CSS Versicherung", category: "insurance", total: 1237.2, count: 3, months: 3 },
    { name: "SBB CFF FFS", category: "transport", total: 1020, count: 6, months: 3 },
    { name: "Coop", category: "groceries", total: 812.3, count: 15, months: 3 },
    { name: "Edelweiss Air", category: "travel", total: 642, count: 1, months: 1 },
    { name: "Hiltl", category: "restaurants", total: 310.5, count: 4, months: 3 },
    { name: "Zalando", category: "shopping", total: 289.8, count: 2, months: 2 },
  ],
  recurring: [
    { name: "Immobilien Verwaltung Zürich", category: "housing", amount: 1890, frequency: "monthly", monthlyCost: 1890, occurrences: 3 },
    { name: "CSS Versicherung", category: "insurance", amount: 412.4, frequency: "monthly", monthlyCost: 412.4, occurrences: 3 },
    { name: "Swisscom", category: "telecom", amount: 69, frequency: "monthly", monthlyCost: 69, occurrences: 3 },
    { name: "Netflix", category: "subscriptions", amount: 18.9, frequency: "monthly", monthlyCost: 18.9, occurrences: 3 },
    { name: "Spotify", category: "subscriptions", amount: 12.95, frequency: "monthly", monthlyCost: 12.95, occurrences: 3 },
  ],
  largestExpenses: [mockTransactions[1], mockTransactions[13], mockTransactions[8], mockTransactions[4], mockTransactions[12]],
  weekdaySpending: [1210.4, 980.2, 1105.7, 1320.9, 2105.3, 2890.1, 640.5],
  transactionCount: 214,
};

export const mockInsights: Insights = {
  score: 78,
  persona: "Sparfuchs mit Ausgehlaune",
  personaText: "Du legst regelmässig etwas zur Seite, gönnst dir aber auch gerne einen Abend auswärts.",
  strengths: [
    { title: "Regelmässig gespart", detail: "Jeden Monat gehen CHF 800 aufs Sparkonto – das ist eine Sparquote von über 25 %." },
    { title: "Fixkosten im Griff", detail: "Handy und Streaming kosten zusammen unter CHF 110 pro Monat." },
  ],
  weaknesses: [
    { title: "Wohnen ist teuer", detail: "Die Miete macht 29 % deines Einkommens aus – die Faustregel liegt bei einem Drittel, du bist knapp darunter." },
    { title: "Wochenend-Effekt", detail: "Samstags gibst du fast dreimal so viel aus wie sonntags." },
  ],
  critiques: [
    {
      title: "Hiltl liebt dich. Dein Budget weniger.",
      detail: "23 Restaurantbesuche in drei Monaten – im Schnitt CHF 395 pro Monat.",
      target: "Restaurants & Take-away",
      category: "restaurants",
      amount: 394.77,
      suggestion: "Zwei Abende pro Monat selber kochen spart rund CHF 120.",
    },
    {
      title: "Das GA, das nie Ferien macht",
      detail: "Du zahlst monatlich CHF 340 für ÖV, auch im Ferienmonat August.",
      target: "SBB CFF FFS",
      category: "transport",
      amount: 340,
      suggestion: "Prüf, ob ein Halbtax plus Sparbillette günstiger kommt.",
    },
  ],
  savings: [
    { title: "Krankenkasse wechseln", detail: "Mit höherer Franchise oder Hausarztmodell sinkt die Prämie spürbar.", monthlySaving: 80, effort: "medium" },
    { title: "Streaming rotieren", detail: "Nur ein Dienst gleichzeitig statt zwei.", monthlySaving: 13, effort: "easy" },
    { title: "Weniger auswärts essen", detail: "Zwei Restaurantbesuche pro Monat ersetzen.", monthlySaving: 120, effort: "easy" },
  ],
  source: "fallback",
};
