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

const LONG_DOCUMENT_TITLE = "Hotel confirmation for a long stay by the old quarter with breakfast and airport pickup.pdf";

interface DetailFit {
  readonly parent: Box;
  readonly table: Box;
  readonly actions: readonly Box[];
  readonly isTitleCut: boolean;
  readonly isStacked: boolean;
}

// #1349: a detail table whose value is a document row with a long title and its buttons stays within a narrow parent
// (a page column beside a side panel): the fixed layout keeps the table at the parent's width, the title shortens
// with an ellipsis and every button shows whole; under 28rem (448 px) the label sits above its value. Geometry, no
// screenshot.
for (const [width, isStacked] of [[360, true], [600, false]] as const) {
  test(`a detail table holding a document row stays within a ${width} px parent`, async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.evaluate(() => document.fonts.ready);

    const fit = await page.evaluate(
      ({ width, title }): DetailFit => {
        const table = document.querySelector('[data-slot="detail-table-frame"]');
        const list = document.querySelector('[data-slot="document-list"]');
        if (table === null || list === null) throw new Error("no detail table or document list in the gallery");
        const parent = document.createElement("div");
        parent.style.width = `${width}px`;
        const tableCopy = table.cloneNode(true) as HTMLElement;
        const listCopy = list.cloneNode(true) as HTMLElement;
        listCopy.removeAttribute("class");
        const row = listCopy.querySelector('[data-slot="document-row"]');
        const titleSpan = listCopy.querySelector<HTMLElement>('[data-slot="document-row-title"]');
        const cell = tableCopy.querySelector("td");
        if (row === null || titleSpan === null || cell === null) throw new Error("no document row or cell to fill");
        titleSpan.textContent = title;
        const actions = document.createElement("div");
        actions.dataset["slot"] = "document-row-actions";
        actions.className = "flex shrink-0 items-center gap-1";
        for (const name of ["Download", "Edit", "Remove"]) {
          // An icon button's size (the theme's `icon-sm`, 28 px).
          const button = document.createElement("button");
          button.setAttribute("aria-label", name);
          button.style.width = "28px";
          button.style.height = "28px";
          actions.append(button);
        }
        row.append(actions);
        cell.replaceChildren(listCopy);
        parent.append(tableCopy);
        document.body.append(parent);

        const toBox = (element: Element): Box => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right };
        };
        return {
          parent: toBox(parent),
          table: toBox(tableCopy),
          actions: [...actions.children].map(toBox),
          isTitleCut: titleSpan.scrollWidth > titleSpan.clientWidth,
          isStacked: getComputedStyle(tableCopy.querySelector("th") ?? tableCopy).display === "block",
        };
      },
      { width, title: LONG_DOCUMENT_TITLE },
    );

    expect(fit.table.left).toBeGreaterThanOrEqual(fit.parent.left);
    expect(fit.table.right).toBeLessThanOrEqual(fit.parent.right);
    expect(fit.isTitleCut).toBe(true);
    expect(fit.isStacked).toBe(isStacked);
    expect(fit.actions).toHaveLength(3);
    for (const action of fit.actions) {
      expect(action.right).toBeLessThanOrEqual(fit.parent.right);
      expect(action.right - action.left).toBeGreaterThan(0);
    }
  });
}

interface FoldRowBar {
  readonly details: Box & { readonly top: number; readonly bottom: number };
  readonly column: Box & { readonly top: number; readonly bottom: number };
  readonly status: { readonly bottom: number; readonly top: number };
  readonly action: { readonly top: number; readonly width: number; readonly height: number };
  readonly detailsLight: string;
  readonly columnLight: string;
}

// Geometry, not pixels (#1471): a FoldRow with a three-line summary, a status and one action reads as one bar. The
// right column is exactly as high as the summary and lights with it; the status sits above the action; on a phone the
// column falls under the summary with a 44 px control.
test("a fold row's action column spans its three-line summary and lights with it", async ({ page }, testInfo) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
  const row = page.locator('[data-slot="fold-row-with-actions"]').first();
  const readBar = (): Promise<FoldRowBar> =>
    row.evaluate((element): FoldRowBar => {
      const find = (slot: string): HTMLElement => {
        const found = element.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
        if (found === null) throw new Error(`no [data-slot="${slot}"] in the fold row`);
        return found;
      };
      const toBox = (target: Element) => {
        const box = target.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      };
      const action = find("fold-row-action-list").firstElementChild;
      if (action === null) throw new Error("no action in the fold row");
      const actionBox = action.getBoundingClientRect();
      return {
        details: toBox(find("fold-row")),
        column: toBox(find("fold-row-actions")),
        status: toBox(find("fold-row-status")),
        action: { top: actionBox.top, width: actionBox.width, height: actionBox.height },
        detailsLight: getComputedStyle(find("fold-row")).backgroundColor,
        columnLight: getComputedStyle(find("fold-row-actions")).backgroundColor,
      };
    });
  const summaryLineHeight = await row
    .locator('[data-slot="fold-row-summary-slot"] > span')
    .evaluate((span) => ({ height: span.getBoundingClientRect().height, line: Number.parseFloat(getComputedStyle(span).lineHeight) }));
  expect(summaryLineHeight.height / summaryLineHeight.line).toBeGreaterThanOrEqual(3);

  const resting = await readBar();
  expect(resting.detailsLight).toBe("rgba(0, 0, 0, 0)");
  expect(resting.columnLight).toBe(resting.detailsLight);

  if (testInfo.project.name.startsWith("phone")) {
    expect(resting.column.top).toBe(resting.details.bottom);
    expect(resting.column.left).toBe(resting.details.left);
    expect(resting.column.right).toBe(resting.details.right);
    expect(resting.action.height).toBeGreaterThanOrEqual(44);
    expect(resting.action.width).toBeGreaterThanOrEqual(44);
  } else {
    expect([resting.column.top, resting.column.bottom]).toEqual([resting.details.top, resting.details.bottom]);
    expect(resting.column.left).toBe(resting.details.right);
    expect(resting.status.bottom).toBeLessThanOrEqual(resting.action.top);
  }

  for (const target of ['[data-slot="fold-row-summary"]', '[data-slot="fold-row-actions"]']) {
    await row.locator(target).hover();
    await expect.poll(async () => (await readBar()).detailsLight).not.toBe("rgba(0, 0, 0, 0)");
    const lit = await readBar();
    expect(lit.columnLight).toBe(lit.detailsLight);
  }

  // Opened, the content runs under the whole bar and the column still ends with the summary.
  await row.locator('[data-slot="fold-row-summary"]').click();
  await expect(row.locator('[data-slot="fold-row-content"]')).toBeVisible();
  const opened = await readBar();
  if (testInfo.project.name.startsWith("phone")) expect(opened.column.top).toBe(opened.details.bottom);
  else expect([opened.column.top, opened.column.bottom]).toEqual([opened.details.top, opened.details.bottom]);
});

interface EntryBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

// Geometry, not pixels (#1481): a ListEntry with a two-line identity, a result badge and two controls. The badge sits
// at the right of the row above the controls, the arrow beside the column; on a phone the column wraps under the
// identity, right-aligned, with 44 px controls, and the arrow stays on the column's line. The stretched link opens the
// row from anywhere but the controls.
test("a list entry keeps its state over its controls at the right and wraps them under the identity on a phone", async ({ page }, testInfo) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
  const entry = page.locator('[data-gallery-list-entry] [data-slot="list-entry"]').first();
  type EntryPart = "row" | "identity" | "title" | "side" | "column" | "badge" | "firstAction" | "lastAction" | "arrow" | "details";
  const boxes = await entry.evaluate((element): Record<EntryPart, EntryBox> => {
    const toBox = (target: Element | null, name: string): EntryBox => {
      if (target === null) throw new Error(`no ${name} in the list entry`);
      const { left, right, top, bottom, width, height } = target.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const find = (slot: string) => element.querySelector(`[data-slot="${slot}"]`);
    const actions = find("list-entry-actions");
    return {
      row: toBox(element, "row"),
      identity: toBox(find("list-entry-identity"), "identity"),
      title: toBox(find("list-entry-title"), "title"),
      side: toBox(find("list-entry-side"), "side"),
      column: toBox(find("list-entry-column"), "column"),
      badge: toBox(find("result-badge"), "badge"),
      firstAction: toBox(actions?.firstElementChild ?? null, "first action"),
      lastAction: toBox(actions?.lastElementChild ?? null, "last action"),
      arrow: toBox(find("list-entry-arrow"), "arrow"),
      details: toBox(find("list-entry-details"), "details"),
    };
  });
  const { row, identity, title, side, column, badge, firstAction, lastAction, arrow, details } = boxes;
  const rowPadding = 8;

  expect(details.height).toBeGreaterThan(title.height); // two detail lines under the title
  expect(side.right).toBeCloseTo(row.right - rowPadding, 0);
  expect(badge.right).toBeCloseTo(column.right, 0);
  expect(lastAction.right).toBeCloseTo(column.right, 0);
  expect(badge.bottom).toBeLessThanOrEqual(firstAction.top);
  expect(arrow.left).toBeGreaterThanOrEqual(column.right);
  // The arrow sits on the column's line, never alone on a line of its own.
  expect(arrow.top).toBeGreaterThanOrEqual(column.top);
  expect(arrow.bottom).toBeLessThanOrEqual(column.bottom);

  if (testInfo.project.name.startsWith("phone")) {
    expect(side.top).toBeGreaterThanOrEqual(identity.bottom);
    expect(firstAction.height).toBeGreaterThanOrEqual(44);
    expect(firstAction.width).toBeGreaterThanOrEqual(44);
  } else {
    expect(side.left).toBeGreaterThanOrEqual(identity.right);
    expect(column.top).toBeLessThan(identity.bottom);
  }

  // A control is its own target; the gap beside the arrow opens the row.
  await entry.getByRole("button", { name: "Retry" }).click();
  expect(new URL(page.url()).hash).toBe("");
  // The arrow lets clicks through (the side is pointer-events: none), so click its spot, as a reader would.
  const arrowNow = await entry.locator('[data-slot="list-entry-arrow"]').boundingBox();
  if (arrowNow === null) throw new Error("the list entry's arrow is not drawn");
  await page.mouse.click(arrowNow.x + arrowNow.width / 2, arrowNow.y + arrowNow.height / 2);
  await expect.poll(() => new URL(page.url()).hash).toBe("#deploy-42");
});

// #1497: with a multi-line identity the state stands on the title's first line, not in the middle of the row; the
// controls follow under it and the arrow stays on the state's line. On a phone the column still wraps under the identity.
test("a list entry with a multi-line identity keeps its state and arrow on the title's line", async ({ page }, testInfo) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
  const entry = page.locator('[data-gallery-list-entry] [data-slot="list-entry"]').first();
  const measures = await entry.evaluate((element) => {
    const find = (slot: string): DOMRect => {
      const target = element.querySelector(`[data-slot="${slot}"]`);
      if (target === null) throw new Error(`no ${slot} in the list entry`);
      return target.getBoundingClientRect();
    };
    const title = element.querySelector('[data-slot="list-entry-title"]');
    if (title === null) throw new Error("no title in the list entry");
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
    const titleBox = title.getBoundingClientRect();
    const middle = (box: DOMRect): number => box.top + box.height / 2;
    return {
      titleLineMiddle: titleBox.top + lineHeight / 2,
      badgeMiddle: middle(find("result-badge")),
      arrowMiddle: middle(find("list-entry-arrow")),
      identityHeight: find("list-entry-identity").height,
      lineHeight,
    };
  });

  expect(measures.identityHeight).toBeGreaterThan(measures.lineHeight * 2); // the title and two detail lines
  if (testInfo.project.name.startsWith("phone")) return; // the column wraps under the identity (checked above)
  expect(Math.abs(measures.badgeMiddle - measures.titleLineMiddle)).toBeLessThanOrEqual(2);
  expect(Math.abs(measures.arrowMiddle - measures.titleLineMiddle)).toBeLessThanOrEqual(2);
});

// #1520: in a linked row with a control and no status, the arrow and the control share one vertical middle, with the
// 24 px icon button on a desktop and its 44 px touch target on a phone.
test("a linked list entry with a control only centres its arrow on the control", async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
  const entry = page.locator('[data-gallery-list-entry] [data-slot="list-entry"]').nth(1);
  const measures = await entry.evaluate((element) => {
    const find = (selector: string): DOMRect => {
      const target = element.querySelector(selector);
      if (target === null) throw new Error(`no ${selector} in the list entry`);
      return target.getBoundingClientRect();
    };
    const middle = (box: DOMRect): number => box.top + box.height / 2;
    const control = find('[data-slot="list-entry-actions"] > *');
    return { arrowMiddle: middle(find('[data-slot="list-entry-arrow"]')), controlMiddle: middle(control), controlHeight: control.height };
  });

  expect(measures.controlHeight).toBeGreaterThan(20); // taller than the arrow's 20 px box
  expect(Math.abs(measures.arrowMiddle - measures.controlMiddle)).toBeLessThanOrEqual(1);
});

test("a data-row-wide control takes the full row width under the identity, starting on the left", async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
  const entry = page.locator('[data-slot="list-entry"]:has([data-row-wide])').first();
  const boxes = await entry.evaluate((element) => {
    const toBox = (target: Element | null) => {
      if (target === null) throw new Error("missing part of the wide list entry");
      const { left, right, top, bottom } = target.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    return {
      identity: toBox(element.querySelector('[data-slot="list-entry-identity"]')),
      side: toBox(element.querySelector('[data-slot="list-entry-side"]')),
      badge: toBox(element.querySelector('[data-slot="result-badge"]')),
      form: toBox(element.querySelector("[data-row-wide]")),
    };
  });

  expect(boxes.side.top).toBeGreaterThanOrEqual(boxes.identity.bottom);
  expect(boxes.form.left).toBeCloseTo(boxes.identity.left, 0);
  expect(boxes.badge.left).toBeCloseTo(boxes.identity.left, 0);
  expect(boxes.form.right).toBeCloseTo(boxes.side.right, 0);
  expect(boxes.side.left).toBeCloseTo(boxes.identity.left, 0);
});

// Geometry, not pixels (#1486): a row with a switch, a result badge and a "More actions" menu. The badge is on top of
// the right column; the switch and the menu button share one line under it at the row's right edge, on a phone each
// at least the 44 px touch target. The menu opens with the keyboard, the arrow keys move between its items, and the
// destructive item, last, opens the confirmation.
test("a list entry keeps its inline control and its menu button on one line under the state", async ({ page }, testInfo) => {
  // The issue's desktop width; the phone projects keep their 390 px.
  if (!testInfo.project.name.startsWith("phone")) await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
  const entry = page.locator('[data-gallery-list-entry-menu] [data-slot="list-entry"]').first();
  const boxes = await entry.evaluate((element) => {
    const toBox = (target: Element | null, name: string) => {
      if (target === null) throw new Error(`no ${name} in the list entry`);
      const { left, right, top, bottom, width, height } = target.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const find = (selector: string) => element.querySelector(selector);
    return {
      row: toBox(element, "row"),
      identity: toBox(find('[data-slot="list-entry-identity"]'), "identity"),
      side: toBox(find('[data-slot="list-entry-side"]'), "side"),
      badge: toBox(find('[data-slot="result-badge"]'), "badge"),
      toggle: toBox(find('[data-slot="switch"]'), "switch"),
      menu: toBox(find('[data-slot="row-actions-menu-trigger"]'), "menu button"),
    };
  });
  const { row, identity, side, badge, toggle, menu } = boxes;
  const rowPadding = 8;
  const middle = (box: { top: number; bottom: number }) => (box.top + box.bottom) / 2;

  expect(badge.bottom).toBeLessThanOrEqual(Math.min(toggle.top, menu.top));
  expect(Math.abs(middle(toggle) - middle(menu))).toBeLessThanOrEqual(1);
  expect(toggle.right).toBeLessThanOrEqual(menu.left);
  expect(menu.right).toBeCloseTo(row.right - rowPadding, 0);
  expect(badge.right).toBeCloseTo(menu.right, 0);

  if (testInfo.project.name.startsWith("phone")) {
    expect(side.top).toBeGreaterThanOrEqual(identity.bottom);
    expect(menu.height).toBeGreaterThanOrEqual(44);
    expect(menu.width).toBeGreaterThanOrEqual(44);
    expect(toggle.height).toBeGreaterThanOrEqual(44);
    expect(toggle.width).toBeGreaterThanOrEqual(44);
  } else {
    expect(side.left).toBeGreaterThanOrEqual(identity.right);
  }

  const trigger = entry.getByRole("button", { name: "More actions" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const items = page.getByRole("menuitem");
  await expect(items).toHaveText(["Test", "Replace token", "Copy address", "Delete"]);
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Delete this webhook?");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

interface LineBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

function readMiddle(box: LineBox): number {
  return box.top + box.height / 2;
}

// #1508: with sideLayout="inline" a ListEntry puts its state left of its controls, on one line at the right of the row
// (a watched repository: a badge and a trash can). On a phone the column wraps under the identity, right-aligned, and
// the controls keep their 44 px targets.
test("an inline list entry keeps its state left of its controls on one line", async ({ page }, testInfo) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
  const entries = page.locator('[data-gallery-list-entry-inline] [data-slot="list-entry"]');
  await expect(entries).toHaveCount(2);
  for (const entry of await entries.all()) {
    const boxes = await entry.evaluate((element) => {
      const toBox = (target: Element | null | undefined, name: string) => {
        if (target === null || target === undefined) throw new Error(`no ${name} in the list entry`);
        const { left, right, top, bottom, width, height } = target.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      const find = (slot: string) => element.querySelector(`[data-slot="${slot}"]`);
      const controls = [...(find("list-entry-actions")?.querySelectorAll("button") ?? [])];
      return {
        row: toBox(element, "row"),
        identity: toBox(find("list-entry-identity"), "identity"),
        side: toBox(find("list-entry-side"), "side"),
        badge: toBox(find("result-badge"), "badge"),
        firstControl: toBox(controls[0], "first control"),
        lastControl: toBox(controls.at(-1), "last control"),
      };
    });
    const { row, identity, side, badge, firstControl, lastControl } = boxes;
    const rowPadding = 8;

    expect(badge.right).toBeLessThanOrEqual(firstControl.left);
    expect(Math.abs(readMiddle(badge) - readMiddle(firstControl))).toBeLessThanOrEqual(2);
    expect(lastControl.right).toBeCloseTo(row.right - rowPadding, 0);
    expect(side.right).toBeCloseTo(row.right - rowPadding, 0);

    if (testInfo.project.name.startsWith("phone")) {
      expect(side.top).toBeGreaterThanOrEqual(identity.bottom);
      expect(firstControl.height).toBeGreaterThanOrEqual(44);
      expect(firstControl.width).toBeGreaterThanOrEqual(44);
    } else {
      expect(side.left).toBeGreaterThanOrEqual(identity.right);
      // One line: the badge stands level with the title's line, not above the controls.
      expect(badge.top).toBeLessThan(identity.top + 20);
    }
  }
});

// #1508: from md up an inline FoldRow puts its status left of its actions, on one line at the right of the bar.
test("an inline fold row keeps its status left of its actions on one line from md up", async ({ page }, testInfo) => {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
  const row = page.locator('[data-gallery-fold-row-inline] [data-slot="fold-row-with-actions"]');
  const boxes = await row.evaluate((element) => {
    const toBox = (target: Element | null | undefined, name: string) => {
      if (target === null || target === undefined) throw new Error(`no ${name} in the fold row`);
      const { left, right, top, bottom, width, height } = target.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const find = (slot: string) => element.querySelector(`[data-slot="${slot}"]`);
    return {
      details: toBox(find("fold-row"), "details"),
      column: toBox(find("fold-row-actions"), "column"),
      status: toBox(find("result-badge"), "status"),
      action: toBox(find("fold-row-action-list")?.firstElementChild, "action"),
    };
  });
  const { details, column, status, action } = boxes;

  expect(status.right).toBeLessThanOrEqual(action.left);
  expect(Math.abs(readMiddle(status) - readMiddle(action))).toBeLessThanOrEqual(2);
  if (testInfo.project.name.startsWith("phone")) {
    expect(column.top).toBe(details.bottom);
    expect(action.height).toBeGreaterThanOrEqual(44);
  } else {
    expect([column.top, column.bottom]).toEqual([details.top, details.bottom]);
    expect(column.left).toBe(details.right);
  }
});
