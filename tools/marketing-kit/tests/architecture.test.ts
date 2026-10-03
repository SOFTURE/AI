import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

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

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "messages" ? [] : listSources(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("marketing-kit source", () => {
  const files = listSources(SRC);

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN)("holds no %s", (_label, pattern) => {
    const hits = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => (pattern.test(line) ? [`${relative(SRC, file)}:${index + 1}: ${line.trim()}`] : [])),
    );
    expect(hits).toEqual([]);
  });
});
