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

const CELL_WIDTH = 96;
const LONG_LABEL = "1,234.56 USD of 3,000 USD";

interface Box {
  readonly left: number;
  readonly right: number;
}

interface LabelFit {
  readonly box: Box;
  readonly isCut: boolean;
  readonly overflow: string;
}

// A MiniProgress with a label longer than a table cell stays in the cell, and both label copies end in an ellipsis
// inside the bar instead of running into the next column (#871). Geometry, no baseline.
test(`a mini progress with a long label stays within a ${CELL_WIDTH} px cell`, async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);

  const fit = await page.evaluate(
    ({ label, width }): { cell: Box; bar: Box; labels: LabelFit[] } => {
      const source = document.querySelector('[data-slot="mini-progress"]');
      if (source === null) throw new Error('no [data-slot="mini-progress"] in the gallery');
      const cell = document.createElement("div");
      cell.style.width = `${width}px`;
      const bar = source.cloneNode(true) as HTMLElement;
      const texts = [...bar.querySelectorAll<HTMLElement>('[data-slot="mini-progress-label"] > span')];
      for (const text of texts) text.textContent = label;
      cell.append(bar);
      document.body.append(cell);

      const toBox = (element: Element): Box => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right };
      };
      return {
        cell: toBox(cell),
        bar: toBox(bar),
        labels: texts.map((text) => ({
          box: toBox(text),
          isCut: text.scrollWidth > text.clientWidth,
          overflow: getComputedStyle(text).textOverflow,
        })),
      };
    },
    { label: LONG_LABEL, width: CELL_WIDTH },
  );

  expect(fit.bar).toEqual(fit.cell);
  expect(fit.labels).toHaveLength(2);
  for (const label of fit.labels) {
    expect(label.box.left).toBeGreaterThanOrEqual(fit.bar.left);
    expect(label.box.right).toBeLessThanOrEqual(fit.bar.right);
    expect(label.isCut).toBe(true);
    expect(label.overflow).toBe("ellipsis");
  }
});

interface TabsFit {
  readonly cell: Box;
  readonly list: Box;
  readonly active: Box;
  readonly root: Box;
  readonly isScrolled: boolean;
}

// Geometry, not pixels (#908): a scrollable tab strip with more tabs than fit keeps to its grid cell, so neither the
// `Tabs` root nor the page around it widens, and the active tab (the fifth of six) is scrolled into view.
test("a scrollable tab strip keeps to its cell and shows its active tab", async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);

  const fit = await page.evaluate((): TabsFit => {
    const list = document.querySelector<HTMLElement>('[data-slot="tabs-list"][data-scrollable="true"]');
    const root = list?.closest('[data-slot="tabs"]');
    const cell = root?.parentElement;
    const active = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (list == null || root == null || cell == null || active == null) throw new Error("no scrollable tabs case in the gallery");
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    };
    return {
      cell: box(cell),
      list: box(list),
      active: box(active),
      root: box(root),
      isScrolled: list.scrollWidth > list.clientWidth && list.scrollLeft > 0,
    };
  });

  expect(fit.list.left).toBeGreaterThanOrEqual(fit.cell.left);
  expect(fit.list.right).toBeLessThanOrEqual(fit.cell.right);
  expect(fit.isScrolled).toBe(true);
  expect(fit.active.left).toBeGreaterThanOrEqual(fit.list.left);
  expect(fit.active.right).toBeLessThanOrEqual(fit.list.right);
  expect(fit.root.right).toBeLessThanOrEqual(fit.cell.right);
});
