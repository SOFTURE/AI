import { expect, type Locator } from "@playwright/test";

export interface TickCheckboxOptions {
  /** How long the checked state may take to show, in ms; Playwright's `expect` timeout by default. */
  readonly timeout?: number;
}

/**
 * Ticks a checkbox and asserts it is checked; a ticked box stays ticked. Works on a native input that is
 * transparent, clipped (`sr-only`) or covered by a custom box, which `locator.check()` refuses because another
 * element "intercepts pointer events": the click is dispatched on the input itself, so the browser toggles it and
 * fires `input` and `change`. A disabled box fails before the click: a dispatched click would tick it anyway.
 */
export async function tickCheckbox(checkbox: Locator, options: TickCheckboxOptions = {}): Promise<void> {
  const { timeout } = options;
  if (!(await checkbox.isChecked())) {
    await expect(checkbox, "a disabled checkbox cannot be ticked").toBeEnabled({ timeout });
    await checkbox.dispatchEvent("click");
  }
  await expect(checkbox).toBeChecked({ timeout });
}
