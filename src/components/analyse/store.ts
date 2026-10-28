"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/types";
import { initialState, reducer, type Action, type State } from "./model";

/**
 * In-memory home of the analysis state. It lives at module level rather than in a component so
 * it survives the route change of a language switch (/de/analyse → /fr/analyse remounts the
 * page). Still nothing is persisted: reloading or closing the tab drops it.
 */
let state: State = initialState;
const listeners = new Set<() => void>();

export function getState(): State {
  return state;
}

export function dispatch(action: Action) {
  const next = reducer(state, action);
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getServerState = () => initialState;

export function useAnalyseState(): State {
  return useSyncExternalStore(subscribe, getState, getServerState);
}

// Each run gets an id; async continuations of an outdated run are ignored.
let runId = 0;
export const nextRunId = () => ++runId;
export const currentRunId = () => runId;

// Language of the visible analyse page; a run started in another language fetches its insights in this one.
let activeLocale: Locale = "de";
export const setActiveLocale = (locale: Locale) => {
  activeLocale = locale;
};
export const getActiveLocale = () => activeLocale;
