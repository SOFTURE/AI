// NFR-3 for the package's own components: colours come from tokens only and copy comes from messages
// only. Raw values belong to src/theme/, copy to src/messages/. (`next/*` imports are an ESLint rule.)
// The guards themselves are tested in @softure-ai/testing.
import { join } from "node:path";
import { findInlineCopy, findRawColors, readSourceFiles } from "@softure-ai/testing/guards";
import { describe, expect, it } from "vitest";

const sources = readSourceFiles(join(import.meta.dirname, "../src/ui"));

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
});
