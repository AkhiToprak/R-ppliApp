import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/analysis";
import { buildFallbackInsights } from "@/lib/llm/fallback-insights";
import { getSampleStatement } from "@/lib/parsers";
import { insightsIn, reducer, type DashboardState, type State } from "./model";

function dashboard(): DashboardState {
  const { transactions } = getSampleStatement();
  const ready = reducer(
    { phase: "processing", stage: "analyse", progress: null, source: { kind: "sample" } },
    { type: "ready", meta: { format: "sample", currency: "CHF" }, transactions, analysis: analyse(transactions) },
  );
  return ready as DashboardState;
}

describe("insights per language", () => {
  it("shows the original as translating until the translation arrives", () => {
    let state: State = dashboard();
    const analysis = (state as DashboardState).analysis;
    const de = buildFallbackInsights(analysis, "de");
    state = reducer(state, { type: "insights", insights: de, locale: "de", version: 0, analysis });
    const d = state as DashboardState;

    expect(insightsIn(d, "de")).toEqual({ insights: de, translating: false, translationFailed: false });
    expect(insightsIn(d, "fr")).toEqual({ insights: de, translating: true, translationFailed: false });

    const fr = buildFallbackInsights(analysis, "fr");
    state = reducer(state, { type: "translating", locale: "fr" });
    state = reducer(state, { type: "translated", locale: "fr", insights: fr, id: d.insightsId });
    const after = state as DashboardState;
    expect(after.translating).toEqual([]);
    expect(insightsIn(after, "fr").insights).toBe(fr);
    expect(insightsIn(after, "de").insights).toBe(de);
  });

  it("drops translations of an outdated set of insights", () => {
    let state: State = dashboard();
    const analysis = (state as DashboardState).analysis;
    state = reducer(state, { type: "insights", insights: buildFallbackInsights(analysis, "de"), locale: "de", version: 0, analysis });
    const oldId = (state as DashboardState).insightsId;
    state = reducer(state, { type: "translating", locale: "en" });
    // Refreshed in Italian while the English translation was in flight.
    const it = buildFallbackInsights(analysis, "it");
    state = reducer(state, { type: "insights", insights: it, locale: "it", version: 1, analysis });
    state = reducer(state, { type: "translated", locale: "en", insights: buildFallbackInsights(analysis, "en"), id: oldId });
    const d = state as DashboardState;
    expect(d.insights).toEqual({ it });
    expect(d.translating).toEqual([]);
  });

  it("keeps the original visible after a failed translation until retried", () => {
    let state: State = dashboard();
    const analysis = (state as DashboardState).analysis;
    const de = buildFallbackInsights(analysis, "de");
    state = reducer(state, { type: "insights", insights: de, locale: "de", version: 0, analysis });
    const id = (state as DashboardState).insightsId;
    state = reducer(state, { type: "translating", locale: "en" });
    state = reducer(state, { type: "translationFailed", locale: "en", id });
    expect(insightsIn(state as DashboardState, "en")).toEqual({ insights: de, translating: false, translationFailed: true });
    state = reducer(state, { type: "retryTranslation", locale: "en" });
    expect(insightsIn(state as DashboardState, "en").translating).toBe(true);
  });
});
