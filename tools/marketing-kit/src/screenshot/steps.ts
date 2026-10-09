import type { Locator, Page } from "playwright";

import type { ShotStep } from "../config/shot-steps.js";
import { getLocator } from "../record/locator.js";

/**
 * Steps of the sign-in and of a screenshot entry, done in order on the page. A step that cannot be done (its
 * element never appears, matches several, is not an input, is not a `<details>`) is the page's or the config's
 * fault, so it comes back as a message naming the step; the message never carries a `fill` value, which may be a
 * password. `open` and `hide` act on every match of their target; the others need exactly one.
 */

/** Long enough for a client-side page to render the element, short enough that a typo does not hang the run. */
export const STEP_TIMEOUT_MS = 10_000;

function describeError(error: unknown): string {
  return error instanceof Error ? (error.message.split("\n")[0] ?? error.name) : String(error);
}

async function runStep(page: Page, step: ShotStep): Promise<void> {
  const timeout = STEP_TIMEOUT_MS;
  switch (step.do) {
    case "fill":
      return getLocator(page, step.target).fill(step.value, { timeout });
    case "click":
      return getLocator(page, step.target).click({ timeout });
    case "check":
      return getLocator(page, step.target).check({ timeout });
    case "press":
      return page.keyboard.press(step.key);
    case "open":
      return openEvery(getLocator(page, step.target));
    case "hide":
      return hideAllButLast(getLocator(page, step.target), step.keepLast);
  }
}

/** Waits for the first match like the other steps do; a step on every match needs at least one. */
async function waitForMatches(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS });
}

/** Opens every match; refuses a match that is not a `<details>` and one that did not stay open. */
async function openEvery(locator: Locator): Promise<void> {
  await waitForMatches(locator);
  const outcome = await locator.evaluateAll((nodes) => {
    const notDetails = nodes.filter((node) => !(node instanceof HTMLDetailsElement)).length;
    if (notDetails > 0) return { total: nodes.length, notDetails, closed: 0 };
    for (const node of nodes) (node as HTMLDetailsElement).open = true;
    // Details sharing a name form an exclusive group: opening one closes the others.
    const closed = nodes.filter((node) => !(node as HTMLDetailsElement).open).length;
    return { total: nodes.length, notDetails, closed };
  });
  if (outcome.notDetails > 0) {
    const verb = outcome.notDetails === 1 ? "is" : "are";
    throw new Error(`${outcome.notDetails} of ${outcome.total} matches ${verb} not a <details> element`);
  }
  if (outcome.closed > 0) throw new Error(`${outcome.closed} of ${outcome.total} <details> did not stay open (details sharing a name show one at a time)`);
}

/** Hides every match but the last `keepLast`; refuses when that would hide nothing (the selector is likely wrong). */
async function hideAllButLast(locator: Locator, keepLast: number): Promise<void> {
  await waitForMatches(locator);
  const total = await locator.evaluateAll((nodes, keep) => {
    if (nodes.length <= keep) return nodes.length;
    for (const node of nodes.slice(0, nodes.length - keep)) {
      if (node instanceof HTMLElement || node instanceof SVGElement) node.style.setProperty("display", "none", "important");
    }
    return nodes.length;
  }, keepLast);
  if (total <= keepLast) throw new Error(`matches ${total} elements, not more than keepLast ${keepLast}, so nothing would be hidden`);
}

/** Null when every step was done; otherwise which one failed (`<where>[<index>] (<do>)`) and why. */
export async function runShotSteps(page: Page, steps: readonly ShotStep[], where: string): Promise<string | null> {
  for (const [index, step] of steps.entries()) {
    try {
      await runStep(page, step);
    } catch (error) {
      // Every Playwright failure of a step (timeout, strict mode, not an input) is the page's or the config's.
      return `${where}[${index}] (${step.do}): ${describeError(error)}`;
    }
  }
  return null;
}
