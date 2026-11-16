# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gallery.spec.ts >> the Sidebar[collapsible=offcanvas] case on its own page
- Location: visual/gallery.spec.ts:52:3

# Error details

```
Error: A snapshot doesn't exist at /home/user/ai/themes/theme-notion/visual/gallery.spec.ts-snapshots/Sidebar-collapsible-offcanvas--linux.png, writing actual.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - textbox "Search" [ref=e8]
    - generic [ref=e10]:
      - generic [ref=e11]: Workspace
      - button "Add page" [ref=e12]
      - list [ref=e15]:
        - listitem [ref=e16]:
          - button "Inbox" [ref=e17]
          - generic: "12"
        - listitem [ref=e22]:
          - button "Projects" [ref=e23]
          - button "Add a project page" [ref=e27]
          - list [ref=e29]:
            - listitem [ref=e30]:
              - link "Roadmap" [ref=e31] [cursor=pointer]:
                - /url: "#roadmap"
            - listitem [ref=e33]:
              - link "Notes" [ref=e34] [cursor=pointer]:
                - /url: "#notes"
        - listitem [ref=e36]
    - list [ref=e41]:
      - listitem [ref=e42]:
        - button "Settings" [ref=e43]
    - button "Toggle Sidebar" [ref=e48]
  - main [ref=e49]:
    - generic [ref=e50]:
      - button "Toggle Sidebar" [ref=e51]
      - generic [ref=e53]: Inbox
```

# Test source

```ts
  1  | import { pathToFileURL } from "node:url";
  2  | import { join } from "node:path";
  3  | 
  4  | import AxeBuilder from "@axe-core/playwright";
  5  | import { expect, test, type Page } from "@playwright/test";
  6  | 
  7  | import { GALLERY_CASES } from "../tests/gallery/cases.js";
  8  | import { GALLERY_DIR } from "./build-gallery.js";
  9  | 
  10 | const PAGE_URL = pathToFileURL(join(GALLERY_DIR, "index.html")).href;
  11 | 
  12 | // WCAG 2.1 A and AA, colour contrast included.
  13 | const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
  14 | 
  15 | // Violations known and tracked elsewhere: the rule, a selector fragment of the offending node, and why it stays.
  16 | // An entry whose violation no longer occurs is harmless; remove it with the fix.
  17 | const KNOWN_VIOLATIONS: readonly { readonly rule: string; readonly target: RegExp; readonly reason: string }[] = [
  18 |   { rule: "aria-required-children", target: /^#radix-/, reason: "cmdk wraps its options in a sizer div inside the listbox (library markup)" },
  19 |   { rule: "aria-hidden-focus", target: /^#gallery$/, reason: "an open Radix Select hides the page while its trigger stays focusable; Tab closes the list" },
  20 |   {
  21 |     rule: "color-contrast",
  22 |     target: /\.text-background[^ ]*\[data-slot="mini-progress-label"\]/,
  23 |     reason: "axe ignores clip-path: MiniProgress's copy on the fill shows only over the fill, where tests/contrast.test.ts pins it at AA",
  24 |   },
  25 | ];
  26 | 
  27 | function isKnown(rule: string, target: string): boolean {
  28 |   return KNOWN_VIOLATIONS.some((known) => known.rule === rule && known.target.test(target));
  29 | }
  30 | 
  31 | async function openCase(page: Page, name: string | null): Promise<void> {
  32 |   await page.goto(name === null ? PAGE_URL : `${PAGE_URL}#${new URLSearchParams({ case: name }).toString()}`);
  33 |   await page.evaluate(() => document.fonts.ready);
  34 | }
  35 | 
  36 | async function expectNoAxeViolations(page: Page): Promise<void> {
  37 |   const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  38 |   const unknown = results.violations.flatMap((violation) =>
  39 |     violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")}`).filter((entry) => !isKnown(entry.split(": ")[0] ?? "", entry.slice(entry.indexOf(": ") + 2))),
  40 |   );
  41 |   expect(unknown).toEqual([]);
  42 | }
  43 | 
  44 | test("the gallery of inline cases", async ({ page }) => {
  45 |   await openCase(page, null);
  46 | 
  47 |   await expect(page).toHaveScreenshot("gallery.png", { fullPage: true });
  48 |   await expectNoAxeViolations(page);
  49 | });
  50 | 
  51 | for (const galleryCase of GALLERY_CASES.filter((candidate) => candidate.isIsolated === true)) {
  52 |   test(`the ${galleryCase.name} case on its own page`, async ({ page }, testInfo) => {
  53 |     await openCase(page, galleryCase.name);
  54 |     // On a phone the sidebar is a sheet behind its trigger: open it, so the sheet itself is what gets compared.
  55 |     const isPhoneSheet = galleryCase.component === "Sidebar" && testInfo.project.name.startsWith("phone") && !galleryCase.name.includes("collapsible=none");
  56 |     if (isPhoneSheet) await page.locator('[data-slot="sidebar-trigger"]').click();
  57 |     if (galleryCase.clickToOpen !== undefined) await page.locator(galleryCase.clickToOpen).first().click();
  58 |     await expect(page.locator(isPhoneSheet ? '[data-slot="sidebar"][data-mobile="true"]' : galleryCase.root).first()).toBeVisible();
  59 | 
> 60 |     await expect(page).toHaveScreenshot(`${galleryCase.name}.png`);
     |     ^ Error: A snapshot doesn't exist at /home/user/ai/themes/theme-notion/visual/gallery.spec.ts-snapshots/Sidebar-collapsible-offcanvas--linux.png, writing actual.
  61 |     await expectNoAxeViolations(page);
  62 |   });
  63 | }
  64 | 
```