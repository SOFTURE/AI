// The block splitter reads every line of an article body, so a line built to make a pattern backtrack must not
// stall it (code-scanning alerts #65, #66, #67: js/polynomial-redos).
import { splitBlocks } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const RUN = 50_000;
const TIME_LIMIT_MS = 200;

function timeSplit(body: string): number {
  const started = performance.now();
  splitBlocks(body);
  return performance.now() - started;
}

describe("splitBlocks", () => {
  it("reads headings, list items and footnote definitions without their markers", () => {
    const blocks = splitBlocks("## Fees  matter \n\n- first item\n2) second item\n\n[^fees]:   The fee table.");

    expect(blocks).toEqual([
      { kind: "heading", text: "Fees  matter", line: 1, level: 2 },
      { kind: "listItem", text: "first item", line: 3 },
      { kind: "listItem", text: "second item", line: 4 },
      { kind: "footnote", text: "The fee table.", line: 6, footnoteId: "fees" },
    ]);
  });

  it("keeps a line without a space after the marker a paragraph", () => {
    const blocks = splitBlocks("#Fees\n\n-item\n\n####### seven");

    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "paragraph", "paragraph"]);
  });

  it("reads an empty footnote definition as a footnote with no text", () => {
    expect(splitBlocks("[^empty]:")).toEqual([{ kind: "footnote", text: "", line: 1, footnoteId: "empty" }]);
  });

  it.each([
    ["heading", `#${" ".repeat(RUN)}x\u2028x`],
    ["list item", `-${" ".repeat(RUN)}x\u2028x`],
    ["numbered list item", `1.${" ".repeat(RUN)}x\u2028x`],
    ["footnote definition", `[^a]:${" ".repeat(RUN)}x\u2028x`],
  ])("splits a %s with a long whitespace run before a line separator in linear time", (_name, line) => {
    expect(timeSplit(line)).toBeLessThan(TIME_LIMIT_MS);
  });
});
