// The keys of a focusable chart area (the cursor, the event axis): one module, so both step the same way.

/**
 * The stop a key moves to, or `undefined` for a key left to the page: → goes on (the first lands on the first stop),
 * ← goes back (the first lands on the last), Home and End jump to the ends; both arrows stop at the ends.
 */
export function getNextIndex(key: string, current: number | null, lastIndex: number): number | undefined {
  if (lastIndex < 0) return undefined;
  switch (key) {
    case "ArrowRight":
      return current === null ? 0 : Math.min(lastIndex, current + 1);
    case "ArrowLeft":
      return current === null ? lastIndex : Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return lastIndex;
    default:
      return undefined;
  }
}
