/** A day as `YYYY-MM-DD`, the form of `--today` and `videos[].today`. */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a `YYYY-MM-DD` that names a real calendar day (not 2026-02-30): the page clock would start at Invalid Date. */
export function isCalendarDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
