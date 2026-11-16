import { join } from "node:path";
import { pathToFileURL } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { BRIDGE_DIR } from "./build-bridge-page.js";

const PAGE_URL = pathToFileURL(join(BRIDGE_DIR, "index.html")).href;

// WCAG 2.1 A and AA, colour contrast included.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Every colour token of ui with the Notion token the bridge points it at (`src/sft-bridge.css`). */
const BRIDGED_COLOURS: readonly (readonly [string, string])[] = [
  ["--sft-color-background", "--background"],
  ["--sft-color-surface", "--card"],
  ["--sft-color-surface-raised", "--popover"],
  ["--sft-color-foreground", "--foreground"],
  ["--sft-color-muted", "--muted-foreground"],
  ["--sft-color-border", "--border"],
  ["--sft-color-border-strong", "--control-off"],
  ["--sft-color-accent", "--primary"],
  ["--sft-color-accent-fill", "--primary"],
  ["--sft-color-accent-fill-hover", "--primary-hover"],
  ["--sft-color-on-accent", "--primary-foreground"],
  ["--sft-color-danger", "--red"],
  ["--sft-color-success", "--green"],
  ["--sft-color-warning", "--orange"],
  ["--sft-color-focus", "--ring"],
];

/** Where the page shows the same ui screen, with the scheme each scope paints in under the project's scheme. */
const SCOPES = ["shell", "frame", "dark-band"] as const;

/** The Notion `card` and `foreground` values (tests/fixtures/notion-tokens.json), as the browser reports them. */
const NOTION_CARD = { light: "rgb(255, 255, 255)", dark: "rgb(32, 32, 32)" } as const;
const NOTION_FOREGROUND = { light: "rgb(55, 53, 47)", dark: "rgb(212, 212, 212)" } as const;

async function openPage(page: Page): Promise<void> {
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
}

/** Each pair's colour as painted inside `scope`: one probe per token, so `var()` resolves on the scope's element. */
async function readPaintedPairs(page: Page, scope: string): Promise<{ sft: string; notion: string; pair: string }[]> {
  return page.evaluate(
    ({ scope, pairs }) => {
      const host = document.querySelector(`[data-bridge-scope="${scope}"]`);
      if (host === null) throw new Error(`the bridge page has no ${scope} scope`);
      const paint = (variable: string): string => {
        const probe = document.createElement("span");
        probe.style.color = `var(${variable})`;
        host.append(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      };
      return pairs.map(([sft, notion]) => ({ pair: `${sft} -> ${notion}`, sft: paint(sft), notion: paint(notion) }));
    },
    { scope, pairs: BRIDGED_COLOURS },
  );
}

for (const scope of SCOPES) {
  test(`ui's colour tokens paint the Notion colours in the ${scope} scope (#1260)`, async ({ page }) => {
    await openPage(page);

    const pairs = await readPaintedPairs(page, scope);

    expect(pairs.map(({ pair, sft }) => `${pair}: ${sft}`)).toEqual(pairs.map(({ pair, notion }) => `${pair}: ${notion}`));
  });
}

test("a ui card and its text take the Notion surface and ink in every scope (#1260)", async ({ page }, testInfo) => {
  await openPage(page);
  const scheme = testInfo.project.name.endsWith("dark") ? "dark" : "light";

  const painted = await page.evaluate(() =>
    ["shell", "frame", "dark-band"].map((scope) => {
      const card = document.querySelector(`[data-bridge-scope="${scope}"] > section`);
      if (card === null) throw new Error(`no ui card in the ${scope} scope`);
      const style = getComputedStyle(card);
      return { scope, background: style.backgroundColor, text: style.color };
    }),
  );

  expect(painted).toEqual([
    { scope: "shell", background: NOTION_CARD[scheme], text: NOTION_FOREGROUND[scheme] },
    { scope: "frame", background: NOTION_CARD[scheme], text: NOTION_FOREGROUND[scheme] },
    { scope: "dark-band", background: NOTION_CARD.dark, text: NOTION_FOREGROUND.dark },
  ]);
});

test("the bridge page", async ({ page }) => {
  await openPage(page);

  await expect(page).toHaveScreenshot("bridge.png", { fullPage: true });
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")}`))).toEqual([]);
});
