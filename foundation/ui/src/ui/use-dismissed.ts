"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

// Dismiss-for-N-days for a banner or a notice. The browser's `localStorage` keeps, under the app's key,
// the local date of the dismissal (`YYYY-MM-DD`, nothing else); the notice stays hidden until `days`
// calendar days have passed. Storage that is blocked (private mode, a sandboxed frame) or full only
// loses the memory: `dismiss` still hides the notice until the page is left. On the server and until
// hydration the notice counts as dismissed, so a dismissed banner never flashes in.

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** The snapshot before the browser's storage can be read. */
const UNKNOWN = "unknown";

const listeners = new Set<() => void>();

/** The local calendar date of `now`, as `YYYY-MM-DD`. */
export function getDismissalDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/**
 * Whether a dismissal stored as `value` still holds on `now`: fewer than `days` calendar days have passed
 * since it. Anything that is not a date-only value holds nothing.
 */
export function isDismissalActive({ value, days, now }: { value: string | null; days: number; now: Date }): boolean {
  const match = value === null ? null : DATE_ONLY.exec(value);
  if (match === null) return false;
  const dismissedDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;
  const elapsed = today - dismissedDay;
  return elapsed >= 0 && elapsed < days;
}

function readStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Blocked storage reads as "never dismissed"; the notice shows.
    return null;
  }
}

function writeStoredValue(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch (error: unknown) {
    // Blocked or full storage: the dismissal lasts until the page is left.
    console.warn(`useDismissed: could not store "${key}"`, error);
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getServerSnapshot(): string | null {
  return UNKNOWN;
}

export interface Dismissal {
  /** Hidden: dismissed fewer than `days` days ago, dismissed on this page, or not known yet. */
  readonly isDismissed: boolean;
  /** Hides the notice and stores today's date. */
  readonly dismiss: () => void;
  /** Forgets the dismissal and shows the notice again. */
  readonly restore: () => void;
}

/** Whether the notice under `key` was dismissed within the last `days` days, and the actions to change it. */
export function useDismissed(key: string, days: number): Dismissal {
  const stored = useSyncExternalStore(subscribe, () => readStoredValue(key), getServerSnapshot);
  const [isDismissedHere, setIsDismissedHere] = useState(false);

  const dismiss = useCallback(() => {
    setIsDismissedHere(true);
    writeStoredValue(key, getDismissalDate(new Date()));
    notify();
  }, [key]);

  const restore = useCallback(() => {
    setIsDismissedHere(false);
    writeStoredValue(key, null);
    notify();
  }, [key]);

  const isDismissed = isDismissedHere || stored === UNKNOWN || isDismissalActive({ value: stored, days, now: new Date() });
  return { isDismissed, dismiss, restore };
}
