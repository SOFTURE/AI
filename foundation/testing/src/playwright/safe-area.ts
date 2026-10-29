import type { Locator, Page } from "@playwright/test";
import { openChromiumSession } from "./cdp.js";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** An iPhone in portrait: the 390 × 844 viewport, the status bar (47 px) and the home indicator (34 px). */
export const IPHONE_SAFE_AREA = {
  viewport: { width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
} as const satisfies { viewport: { width: number; height: number }; insets: SafeAreaInsets };

/**
 * Sets `env(safe-area-inset-*)` of the page (the page needs `viewport-fit=cover`, like on a phone).
 * Chromium only (CDP `Emulation.setSafeAreaInsetsOverride`).
 */
export async function emulateSafeAreaInsets(page: Page, insets: SafeAreaInsets): Promise<void> {
  const session = await openChromiumSession(page, "emulateSafeAreaInsets");
  await session.send("Emulation.setSafeAreaInsetsOverride", { insets: { ...insets } });
}

export type ColorScheme = "light" | "dark";

export interface ExpectClearOfSafeAreaInsetsOptions {
  /** The schemes to check in, one after the other; the page goes back to the context's scheme after. Default: both. */
  colorSchemes?: readonly ColorScheme[];
}

interface Overlap {
  control: string;
  band: string;
}

/**
 * No visible element of `controls` overlaps an inset band (the strip of the viewport each inset
 * covers), in light and dark. Checked at the current scroll position: content scrolled under the
 * status bar is fine, a fixed header or tab bar in the band is not.
 */
export async function expectClearOfSafeAreaInsets(controls: Locator, insets: SafeAreaInsets, options: ExpectClearOfSafeAreaInsetsOptions = {}): Promise<void> {
  const page = controls.page();
  const overlaps: string[] = [];
  try {
    for (const colorScheme of options.colorSchemes ?? ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      const found = await controls.evaluateAll(findOverlaps, insets);
      overlaps.push(...found.map((overlap) => `- ${overlap.control} overlaps the ${overlap.band} inset (${colorScheme})`));
    }
  } finally {
    await page.emulateMedia({ colorScheme: null });
  }
  if (overlaps.length > 0) throw new Error(`Controls inside a safe-area inset band:\n${overlaps.join("\n")}`);
}

// Runs in the page.
function findOverlaps(elements: Element[], insets: SafeAreaInsets): Overlap[] {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const bands: Record<string, { top: number; right: number; bottom: number; left: number }> = {
    top: { top: 0, right: width, bottom: insets.top, left: 0 },
    bottom: { top: height - insets.bottom, right: width, bottom: height, left: 0 },
    left: { top: 0, right: insets.left, bottom: height, left: 0 },
    right: { top: 0, right: width, bottom: height, left: width - insets.right },
  };
  const overlaps: Overlap[] = [];
  for (const element of elements) {
    if (!element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const label = element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? "";
    const control = `<${element.tagName.toLowerCase()}> "${label}" at ${String(Math.round(box.left))},${String(Math.round(box.top))}`;
    for (const [band, area] of Object.entries(bands)) {
      const isEmpty = area.right <= area.left || area.bottom <= area.top;
      if (!isEmpty && box.left < area.right && box.right > area.left && box.top < area.bottom && box.bottom > area.top) overlaps.push({ control, band });
    }
  }
  return overlaps;
}
