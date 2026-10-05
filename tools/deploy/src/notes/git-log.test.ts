import { describe, expect, it } from "vitest";
import { parseGitLog } from "./git-log.js";

describe("parseGitLog", () => {
  it("splits records and fields, keeping multi-line bodies", () => {
    const raw = "aaa\x1fFirst subject\x1fLine one\nLine two\n\x1e\nbbb\x1fSecond subject\x1f\x1e\n";
    expect(parseGitLog(raw)).toEqual([
      { sha: "aaa", subject: "First subject", body: "Line one\nLine two" },
      { sha: "bbb", subject: "Second subject", body: "" },
    ]);
  });

  it("returns an empty list for an empty range", () => {
    expect(parseGitLog("")).toEqual([]);
    expect(parseGitLog("\n")).toEqual([]);
  });
});
