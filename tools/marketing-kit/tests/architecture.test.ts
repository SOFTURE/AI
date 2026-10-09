import { join } from "node:path";
import { findLines, readSourceFiles } from "@softure-ai/testing/guards";
import { describe, expect, it } from "vitest";

/**
 * No product-specific literal in the package's source: everything about a product comes from its
 * `marketing.json`. The list is the inventory of FIRE_TRACKER constants MK-1 ported (MK-2 research);
 * tests may still use them as fixtures.
 */
const FORBIDDEN: [string, RegExp][] = [
  ["the FIRE config file name", /marketing\.config\.json/],
  ["the FIRE phone viewport", /\b390\b|\b844\b/],
  ["a fixed device scale", /deviceScaleFactor:\s*\d/],
  ["a fixed colour scheme", /colorScheme:\s*"(?:dark|light)"/],
  ["a fixed locale", /\bpl-PL\b|"pl"/],
  ["a fixed timezone", /Europe\/Warsaw/],
  ["FIRE's hidden elements", /nextjs-portal|lista-przyklejona/],
  ["the screen guard on main", /locator\("main"\)/],
  ["FIRE's fonts", /Geist|Newsreader|geist-|newsreader-/],
  ["FIRE's caption colours", /#059669|rgba\(236,\s*241,\s*247/],
  ["FIRE's token names", /\b(?:c|tokens|colors)\.(?:accessible|locked|debt)\b|"(?:accessible|locked|debt)"/],
  ["FIRE's narrator voice", /P9yx385KN0FOmLll8Lkx/],
  ["the channel parameter", /\?z=/],
  ["FIRE's sound file names", /click-soft|key-press|sparkle\.mp3|whoosh\.mp3|pop\.mp3/],
];

const SRC = join(import.meta.dirname, "..", "src");

describe("marketing-kit source", () => {
  // Message dictionaries hold copy, not product constants.
  const files = readSourceFiles(SRC, { include: /^(?!.*\.test\.ts$).*\.ts$/, skipDirs: ["node_modules", "messages"] });

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN)("holds no %s", (_label, pattern) => {
    expect(findLines(files, pattern)).toEqual([]);
  });
});
