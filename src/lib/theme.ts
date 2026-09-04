import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const KEY = "borrower-copilot-theme";
let theme: Theme = "dark";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setTheme(next: Theme) {
  theme = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  emit();
}

export function toggleTheme() {
  setTheme(theme === "light" ? "dark" : "light");
}

/**
 * The appearance is resolved after hydration (saved choice, else the device
 * preference) so that server and client markup always agree.
 */
export function useTheme(): Theme {
  const value = useSyncExternalStore(
    subscribe,
    useCallback(() => theme, []),
    () => "dark" as Theme,
  );

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(KEY);
    } catch {
      /* ignore */
    }
    const resolved: Theme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    if (resolved !== theme) {
      theme = resolved;
      emit();
    }
  }, []);

  return value;
}
