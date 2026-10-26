import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCss } from "../scripts/build-css.mjs";
import * as theme from "../src/index.js";
import { ButtonLink, DisclosureMenu } from "../src/index.js";

// Issue #777: the panel's link rules (a class plus an element) outranked a link's own single-class rules in the
// same layer, so a `ButtonLink` in the panel lost its button look. They now skip links with `data-variant` and
// compile to zero specificity.

const outDir = mkdtempSync(join(tmpdir(), "softure-ui-777-"));
let css = "";

beforeAll(() => {
  buildCss({ outDir, theme });
  css = readFileSync(join(outDir, "styles.css"), "utf8");
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

/** A class name as a CSS selector writes it (the `CSS.escape` rules Tailwind follows). */
function escapeClassName(className: string): string {
  return [...className]
    .map((char, index) => {
      if (/[a-zA-Z_-]/.test(char) || (/\d/.test(char) && index > 0)) return char;
      if (/\d/.test(char)) return `\\${char.charCodeAt(0).toString(16)} `;
      return `\\${char}`;
    })
    .join("");
}

/** Every selector in the stylesheet that names one of these classes and reaches a descendant link. */
function getLinkSelectors(classNames: readonly string[]): string[] {
  const escaped = classNames.map((className) => `.${escapeClassName(className)}`);
  const selectors: string[] = [];
  for (const [, selector] of css.matchAll(/([^{}]+)\{/g)) {
    const text = (selector ?? "").trim();
    if (/\sa(?:[:)\s,]|$)/.test(text) && escaped.some((className) => text.includes(className))) selectors.push(text);
  }
  return selectors;
}

const MENU_MARKUP = renderToStaticMarkup(
  <DisclosureMenu label="Account" defaultOpen>
    <a href="#profile">Profile</a>
    <ButtonLink href="#upgrade" variant="primary">
      Upgrade
    </ButtonLink>
  </DisclosureMenu>,
);

/** The class list of the first element in the markup that matches the pattern. */
function getClasses(markup: string, pattern: RegExp): string[] {
  const tag = pattern.exec(markup)?.[0] ?? "";
  return (/class="([^"]*)"/.exec(tag)?.[1] ?? "").replaceAll("&amp;", "&").split(/\s+/).filter(Boolean);
}

describe("DisclosureMenu panel links (#777)", () => {
  it("compiles every panel link rule to a zero-specificity selector that skips links with a variant", () => {
    const selectors = getLinkSelectors(getClasses(MENU_MARKUP, /<div[^>]*data-state="open"[^>]*>/));
    // Nine utilities: block, rounded, padding x and y, colour, no underline, hover background, two outline rules.
    expect(new Set(selectors).size).toBe(9);
    for (const selector of selectors) {
      expect(selector).toMatch(/^:where\(.*\)$/);
      expect(selector).toContain(" a:not([data-variant])");
    }
  });

  it("leaves a ButtonLink in the panel with its own variant and classes", () => {
    const standalone = renderToStaticMarkup(
      <ButtonLink href="#upgrade" variant="primary">
        Upgrade
      </ButtonLink>,
    );
    const inPanel = /<a[^>]*href="#upgrade"[^>]*>/.exec(MENU_MARKUP)?.[0];
    expect(inPanel).toContain('data-variant="primary"');
    expect(getClasses(MENU_MARKUP, /<a[^>]*href="#upgrade"[^>]*>/)).toEqual(getClasses(standalone, /<a[^>]*>/));
  });
});
