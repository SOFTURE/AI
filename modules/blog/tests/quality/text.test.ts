// Link and footnote matching stays linear on hostile input (CodeQL: polynomial regular expressions),
// and nested brackets end a link text instead of rescanning the rest of the body.
import { findFootnoteRefs, findLinks } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const HOSTILE = 50_000;

describe("findLinks and findFootnoteRefs", () => {
  it("read links, titled links and footnote references", () => {
    expect(findLinks('See [the fees](/blog/fees "Fees") and [a guide](https://example.com/a).')).toEqual([
      { text: "the fees", url: "/blog/fees" },
      { text: "a guide", url: "https://example.com/a" },
    ]);
    expect(findFootnoteRefs("About $4,600[^calc] and 0.2%[^sec].")).toEqual(["calc", "sec"]);
  });

  it("take no link text or footnote id across an opening bracket", () => {
    expect(findLinks("[see [the fees](/blog/fees)")).toEqual([{ text: "the fees", url: "/blog/fees" }]);
    expect(findFootnoteRefs("[^a [^b]")).toEqual(["b"]);
  });

  it("finish quickly on long runs of unclosed brackets", () => {
    const started = performance.now();
    expect(findLinks("[" + "[\\".repeat(HOSTILE))).toEqual([]);
    expect(findLinks("[](" + "[](!".repeat(HOSTILE))).toEqual([]);
    expect(findFootnoteRefs("[^" + "[^\\".repeat(HOSTILE))).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
