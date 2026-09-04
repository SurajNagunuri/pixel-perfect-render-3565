import { useCallback, useSyncExternalStore } from "react";
import { emptyAnswers } from "@/data/sampleBorrowers";
import type { Answers } from "@/types";

const KEY = "borrower-copilot-answers";

let state: Answers = emptyAnswers;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) state = { ...emptyAnswers, ...(JSON.parse(raw) as Answers) };
  } catch {
    /* ignore */
  }
}

function emit() {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function setAnswers(patch: Partial<Answers>) {
  load();
  state = { ...state, ...patch };
  emit();
}

export function replaceAnswers(next: Answers) {
  state = { ...next };
  emit();
}

export function resetAnswers() {
  state = { ...emptyAnswers };
  emit();
}

export function getAnswers(): Answers {
  load();
  return state;
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAnswers(): Answers {
  const getSnapshot = useCallback(() => getAnswers(), []);
  return useSyncExternalStore(subscribe, getSnapshot, () => emptyAnswers);
}
