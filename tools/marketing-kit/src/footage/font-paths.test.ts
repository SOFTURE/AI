import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FOOTAGE_DRAFT_FONT } from "./draft.js";
import { HAND_FONT } from "./hand-font.js";

const SRC = fileURLToPath(new URL("..", import.meta.url));

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSources(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("the kit's bundled fonts", () => {
  it("resolve to the files shipped in fonts/", () => {
    expect(HAND_FONT.file.endsWith("fonts/Caveat-SemiBold-Latin.ttf")).toBe(true);
    expect(FOOTAGE_DRAFT_FONT.file.endsWith("fonts/DejaVuSans-Bold-Latin.ttf")).toBe(true);
    expect(existsSync(HAND_FONT.file)).toBe(true);
    expect(existsSync(FOOTAGE_DRAFT_FONT.file)).toBe(true);
  });

  it("are never located with new URL(..., import.meta.url), which a bundler turns into an asset fileURLToPath refuses", () => {
    const offenders = listSources(SRC).filter((file) => /new URL\([^)]*import\.meta\.url\)/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
