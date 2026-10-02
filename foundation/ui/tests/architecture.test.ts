// NFR-3 for the package's own components: colours come from tokens only. Raw values belong to the
// token defaults in src/theme/, never to src/ui/.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI_DIR = join(import.meta.dirname, "../src/ui");
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;

function findRawColors(source: string): string[] {
  return source.split("\n").filter((line) => RAW_COLOR.test(line));
}

describe("src/ui", () => {
  it("has no raw colour literal", () => {
    const files = readdirSync(UI_DIR).filter((file) => /\.tsx?$/.test(file));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(findRawColors(readFileSync(join(UI_DIR, file), "utf8")), file).toEqual([]);
    }
  });

  it("would catch a planted literal", () => {
    expect(findRawColors('const a = "sft:bg-[#ff0000]";\nconst b = "rgb(0 0 0)";')).toHaveLength(2);
    expect(findRawColors('const c = "sft:bg-surface";')).toEqual([]);
  });
});
