import type { Page } from "playwright";

import type { ShotStep } from "../config/shot-steps.js";
import { getLocator } from "../record/locator.js";

/**
 * Steps of the sign-in and of a screenshot entry, done in order on the page. A step that cannot be done (its
 * element never appears, matches several, is not an input) is the page's or the config's fault, so it comes back as
 * a message naming the step; the message never carries a `fill` value, which may be a password.
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
  }
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
