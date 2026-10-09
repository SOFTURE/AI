// NFR-3 for the module's own markup: no raw colours, no inline copy, and only classes that
// @softure-ai/ui compiles. The module ships no CSS of its own: ui's styles.css is compiled from
// foundation/ui/src/ui, and its styles test requires a selector for every class written there, so
// a class the module shares with ui is a class that exists. (`next/*` imports are an ESLint rule.)
import { join } from "node:path";
import { findInlineCopy, findRawColors, readSourceFiles } from "@softure-ai/testing/guards";
import { describe, expect, it } from "vitest";

const SFT_CLASS = /sft:[^\s"'`]+/g;

const sources = readSourceFiles(join(import.meta.dirname, "../src"), { dirs: ["next"] });
const uiClasses = new Set(
  readSourceFiles(join(import.meta.dirname, "../../../foundation/ui/src/ui")).flatMap(({ source }) => source.match(SFT_CLASS) ?? []),
);

describe("mailing markup", () => {
  it("has components to check", () => {
    expect(sources.filter(({ file }) => file.endsWith(".tsx")).length).toBeGreaterThanOrEqual(1);
  });

  it("has no raw colour literal", () => {
    expect(findRawColors(sources)).toEqual([]);
  });

  it("has no inline copy: every visible and ARIA text comes from messages", () => {
    expect(findInlineCopy(sources)).toEqual([]);
  });

  it("uses only sft: classes that @softure-ai/ui compiles", () => {
    for (const { file, source } of sources) {
      const missing = (source.match(SFT_CLASS) ?? []).filter((name) => !uiClasses.has(name));
      expect(missing, file).toEqual([]);
    }
  });

  it("would catch a class ui does not use", () => {
    expect(uiClasses.has("sft:text-accent")).toBe(true);
    expect(uiClasses.has("sft:text-rainbow")).toBe(false);
  });
});
