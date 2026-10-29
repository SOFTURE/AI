import type { Locator, Page } from "@playwright/test";

/** The touch target of the SOFTURE themes (`touch-target` / `touch` token), Apple's HIG minimum. */
export const TOUCH_TARGET_PX = 44;

/** What a phone user taps: links, buttons, form controls and the ARIA widgets that act like them. */
export const TAPPABLE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  ...["button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "option", "combobox"].map((role) => `[role=${role}]`),
].join(", ");

export interface ExpectTouchTargetsOptions {
  /** The smallest width and height, in CSS pixels. Default: `TOUCH_TARGET_PX`. */
  minSize?: number;
  /** The controls to check instead of every tappable element in `scope`. */
  controls?: Locator;
}

interface SmallControl {
  control: string;
  width: number;
  height: number;
}

/**
 * Every visible tappable control in `scope` (a page or a part of it) is at least `minSize` wide and
 * tall. A failure lists each control with its size.
 */
export async function expectTouchTargets(scope: Page | Locator, options: ExpectTouchTargetsOptions = {}): Promise<void> {
  const minSize = options.minSize ?? TOUCH_TARGET_PX;
  const controls = options.controls ?? scope.locator(TAPPABLE_SELECTOR);
  const small = await controls.evaluateAll(findSmallControls, minSize);
  if (small.length === 0) return;
  const lines = small.map((found) => `- ${found.control} is ${String(found.width)} × ${String(found.height)} px`);
  throw new Error(`Controls under the ${String(minSize)} × ${String(minSize)} px touch target:\n${lines.join("\n")}`);
}

// Runs in the page.
function findSmallControls(elements: Element[], minSize: number): SmallControl[] {
  const small: SmallControl[] = [];
  for (const element of elements) {
    if (!element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const box = element.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    const width = Math.round(box.width * 10) / 10;
    const height = Math.round(box.height * 10) / 10;
    if (width >= minSize && height >= minSize) continue;
    const label = element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? "";
    small.push({ control: `<${element.tagName.toLowerCase()}> "${label}"`, width, height });
  }
  return small;
}
