import { pathToFileURL } from "node:url";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { GALLERY_CASES } from "../tests/gallery/cases.js";
import { GALLERY_DIR } from "./build-gallery.js";

const PAGE_URL = pathToFileURL(join(GALLERY_DIR, "index.html")).href;

// WCAG 2.1 A and AA, colour contrast included.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Violations known and tracked elsewhere: the rule, a selector fragment of the offending node, and why it stays.
// An entry whose violation no longer occurs is harmless; remove it with the fix.
const KNOWN_VIOLATIONS: readonly { readonly rule: string; readonly target: RegExp; readonly reason: string }[] = [
  { rule: "aria-required-children", target: /^#radix-/, reason: "cmdk wraps its options in a sizer div inside the listbox (library markup)" },
  { rule: "aria-hidden-focus", target: /^#gallery$/, reason: "an open Radix Select hides the page while its trigger stays focusable; Tab closes the list" },
  {
    rule: "color-contrast",
    target: /\.text-background[^ ]*\[data-slot="mini-progress-label"\]/,
    reason: "axe ignores clip-path: MiniProgress's copy on the fill shows only over the fill, where tests/contrast.test.ts pins it at AA",
  },
];

function isKnown(rule: string, target: string): boolean {
  return KNOWN_VIOLATIONS.some((known) => known.rule === rule && known.target.test(target));
}

async function openCase(page: Page, name: string | null): Promise<void> {
  await page.goto(name === null ? PAGE_URL : `${PAGE_URL}#${new URLSearchParams({ case: name }).toString()}`);
  await page.evaluate(() => document.fonts.ready);
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const unknown = results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")}`).filter((entry) => !isKnown(entry.split(": ")[0] ?? "", entry.slice(entry.indexOf(": ") + 2))),
  );
  expect(unknown).toEqual([]);
}

test("the gallery of inline cases", async ({ page }) => {
  await openCase(page, null);

  await expect(page).toHaveScreenshot("gallery.png", { fullPage: true });
  await expectNoAxeViolations(page);
});

for (const galleryCase of GALLERY_CASES.filter((candidate) => candidate.isIsolated === true)) {
  test(`the ${galleryCase.name} case on its own page`, async ({ page }, testInfo) => {
    await openCase(page, galleryCase.name);
    // On a phone the sidebar is a sheet behind its trigger: open it, so the sheet itself is what gets compared.
    const isPhoneSheet = galleryCase.component === "Sidebar" && testInfo.project.name.startsWith("phone") && !galleryCase.name.includes("collapsible=none");
    if (isPhoneSheet) await page.locator('[data-slot="sidebar-trigger"]').click();
    if (galleryCase.clickToOpen !== undefined) await page.locator(galleryCase.clickToOpen).first().click();
    await expect(page.locator(isPhoneSheet ? '[data-slot="sidebar"][data-mobile="true"]' : galleryCase.root).first()).toBeVisible();

    await expect(page).toHaveScreenshot(`${galleryCase.name}.png`);
    await expectNoAxeViolations(page);
  });
}
