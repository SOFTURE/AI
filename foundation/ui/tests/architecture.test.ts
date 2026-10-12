// NFR-3 for the package's own components: colours come from tokens only and copy comes from messages
// only. Raw values belong to src/theme/, copy to src/messages/. (`next/*` imports are an ESLint rule.)
// The package also runs its own design-system guards from `ui/testing` (tested in testing-*.test.ts);
// the others are tested in @softure-ai/testing.
import { join } from "node:path";
import { findInlineCopy, findRawColors, readSourceFiles } from "@softure-ai/testing/guards";
import { describe, expect, it } from "vitest";
import { buildStylesInput } from "../scripts/build-css.mjs";
import * as theme from "../src/index.js";
import {
  findHoverOnlyHandlers,
  findNativeTooltips,
  findRestrictedElements,
  findUndefinedTokenClasses,
} from "../src/testing/index.js";

const UI_DIR = join(import.meta.dirname, "../src/ui");
const sources = readSourceFiles(UI_DIR);

describe("src/ui", () => {
  it("has components to check", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it("has no raw colour literal", () => {
    expect(findRawColors(sources)).toEqual([]);
  });

  it("has no inline copy: every visible and ARIA text comes from messages or props", () => {
    expect(findInlineCopy(sources)).toEqual([]);
  });

  it("has no Tailwind class whose colour, ease or duration token is undefined", () => {
    const css = buildStylesInput(theme, UI_DIR);
    expect(findUndefinedTokenClasses({ css, sources, prefix: "sft" })).toEqual([]);
  });

  it("has no native title tooltip and nothing that opens on hover only", () => {
    expect(findNativeTooltips(sources)).toEqual([]);
    expect(findHoverOnlyHandlers(sources)).toEqual([]);
  });

  it("renders a raw <select> nowhere and calls createPortal only in Modal", () => {
    expect(findRestrictedElements(sources, { select: [], createPortal: ["modal.tsx"] })).toEqual([]);
  });
});
