import { pathToFileURL } from "node:url";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { GALLERY_DIR } from "./build-gallery.js";

const PAGE_URL = pathToFileURL(join(GALLERY_DIR, "index.html")).href;
const LONG_WORD = "Observation, day 1 of 30";
const PARENT_WIDTH = 120;

interface Fit {
  readonly parent: { readonly left: number; readonly right: number };
  readonly badge: { readonly left: number; readonly right: number };
  readonly textLeft: number;
  readonly iconWidth: number | null;
  readonly isLabelCut: boolean | null;
  readonly labelOverflow: string | null;
}

// Geometry, not pixels: a copy of a rendered badge with a long word goes into a narrow parent (a grid card, a table
// cell) and must stay inside it (#864). No screenshot, so no baseline.
for (const slot of ["status", "badge"] as const) {
  test(`a ${slot} with a long word stays within a ${PARENT_WIDTH} px parent`, async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.evaluate(() => document.fonts.ready);

    const fit = await page.evaluate(
      ({ slot, word, width }): Fit => {
        const source = document.querySelector(`[data-slot="${slot}"]`);
        if (source === null) throw new Error(`no [data-slot="${slot}"] in the gallery`);
        const parent = document.createElement("div");
        parent.style.width = `${width}px`;
        const badge = source.cloneNode(true) as HTMLElement;
        const label = badge.querySelector<HTMLElement>('[data-slot="status-label"]');
        if (label === null) badge.textContent = word;
        else label.textContent = word;
        parent.append(badge);
        document.body.append(parent);

        const parentBox = parent.getBoundingClientRect();
        const badgeBox = badge.getBoundingClientRect();
        const icon = badge.querySelector("svg");
        const text = document.createRange();
        text.selectNodeContents(label ?? badge);
        return {
          parent: { left: parentBox.left, right: parentBox.right },
          badge: { left: badgeBox.left, right: badgeBox.right },
          textLeft: text.getBoundingClientRect().left,
          iconWidth: icon === null ? null : icon.getBoundingClientRect().width,
          isLabelCut: label === null ? null : label.scrollWidth > label.clientWidth,
          labelOverflow: label === null ? null : getComputedStyle(label).textOverflow,
        };
      },
      { slot, word: LONG_WORD, width: PARENT_WIDTH },
    );

    expect(fit.badge.left).toBeGreaterThanOrEqual(fit.parent.left);
    expect(fit.badge.right).toBeLessThanOrEqual(fit.parent.right);
    // The cut falls at the end: the text starts inside the badge, not centred past its left edge.
    expect(fit.textLeft).toBeGreaterThanOrEqual(fit.badge.left);
    if (slot === "status") {
      expect(fit.iconWidth).toBe(16);
      expect(fit.isLabelCut).toBe(true);
      expect(fit.labelOverflow).toBe("ellipsis");
    }
  });
}
