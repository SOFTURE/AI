// @vitest-environment happy-dom
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { GALLERY_CASES } from "./gallery/cases.js";
import { collectSlots, type SlotClasses } from "./gallery/collect.js";
import { installDomShims } from "./gallery/dom.js";

// Every case's `data-slot` elements with their class strings. `UPDATE_FIXTURES=1` rewrites the file from the
// sources, so a class change shows up as a fixture diff in review (README, "Testing").
// A path, not a URL: happy-dom replaces the global `URL`, which `node:fs` refuses.
const FIXTURE_PATH = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "notion-slots.json");
const isUpdating = process.env["UPDATE_FIXTURES"] === "1";
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Record<string, SlotClasses[]>;
const rendered: Record<string, SlotClasses[]> = {};

/** Cases in name order, one slot per line, so a changed class is a one-line diff. */
function formatFixture(slotsByCase: Readonly<Record<string, readonly SlotClasses[]>>): string {
  const entries = Object.keys(slotsByCase)
    .sort()
    .map((name) => {
      const slots = (slotsByCase[name] ?? []).map((slot) => `    ${JSON.stringify(slot)}`).join(",\n");
      return `  ${JSON.stringify(name)}: [\n${slots}\n  ]`;
    });
  return `{\n${entries.join(",\n")}\n}\n`;
}

beforeAll(installDomShims);
afterEach(cleanup);
afterAll(() => {
  if (isUpdating) writeFileSync(FIXTURE_PATH, formatFixture(rendered));
});

describe("class parity with the design system fixture", () => {
  it("has a fixture entry for every case and no entry without a case", () => {
    if (isUpdating) return;
    expect(Object.keys(fixture).sort()).toEqual(GALLERY_CASES.map((galleryCase) => galleryCase.name).sort());
  });

  it.each(GALLERY_CASES.map((galleryCase) => [galleryCase.name, galleryCase] as const))("%s draws every slot with the fixture's classes", (name, galleryCase) => {
    render(galleryCase.render());
    const slots = collectSlots(document.body);
    rendered[name] = slots;

    if (!isUpdating) expect(slots).toEqual(fixture[name]);
  });
});
