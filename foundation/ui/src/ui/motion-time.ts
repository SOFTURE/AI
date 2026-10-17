// How long a leave motion runs, read from the computed styles, so a component can keep an element shown until
// its transition or animation ends. Shared by `Modal` and `DisclosureMenu`.

/** The longest wait from a list of CSS times ("0.2s, 150ms"). */
function getLongestTime(durations: string, delays: string): number {
  const toMs = (time: string) => (time.trim().endsWith("ms") ? Number.parseFloat(time) : Number.parseFloat(time) * 1000);
  const delayList = delays.split(",");
  return durations
    .split(",")
    .map((duration, index) => toMs(duration) + toMs(delayList[index % delayList.length] ?? "0s"))
    .filter((time) => Number.isFinite(time))
    .reduce((longest, time) => Math.max(longest, time), 0);
}

/** How long the leave motion of these elements runs, in ms; 0 when nothing moves. */
export function getLeaveTime(elements: readonly (HTMLElement | null)[]): number {
  return elements.reduce((longest, element) => {
    if (element === null) return longest;
    const style = getComputedStyle(element);
    return Math.max(
      longest,
      getLongestTime(style.transitionDuration || "0s", style.transitionDelay || "0s"),
      getLongestTime(style.animationDuration || "0s", style.animationDelay || "0s"),
    );
  }, 0);
}

/** A leave motion that never ends (a missing `transitionend`) still closes after this. */
export const LEAVE_TIMEOUT_MS = 1000;
