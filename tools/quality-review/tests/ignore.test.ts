import { afterEach, describe, expect, it } from "vitest";
import { extractFindings } from "../src/findings.js";
import { applyIgnoreRules, getAgentsSection, matchesGlob, parseIgnoreLines, readIgnoreRules } from "../src/ignore.js";
import { makeAgentFinding, makeRepo, toBlock } from "./fixtures.js";

let cleanup = (): void => undefined;
afterEach(() => {
  cleanup();
});

describe("parseIgnoreLines", () => {
  it("reads ids, rules with and without a glob, and paths; skips comments, bullets and backticks", () => {
    const text = [
      "# accepted on purpose",
      "QR-1a2b3c4d   # a known false positive",
      "rule unused-export src/sdk/**",
      "- `rule empty-test`",
      "path legacy/**",
      "",
    ].join("\n");
    expect(parseIgnoreLines(text, "quality-review.ignore")).toEqual({
      rules: [
        { kind: "id", id: "QR-1a2b3c4d", source: "quality-review.ignore:2" },
        { kind: "rule", rule: "unused-export", glob: "src/sdk/**", source: "quality-review.ignore:3" },
        { kind: "rule", rule: "empty-test", glob: null, source: "quality-review.ignore:4" },
        { kind: "path", glob: "legacy/**", source: "quality-review.ignore:5" },
      ],
      invalid: [],
    });
  });

  it("lists a line in none of the forms as invalid", () => {
    expect(parseIgnoreLines("QR-123\nrule no-such-rule\npath\nsomething else", "f").invalid).toEqual([
      "f:1: QR-123",
      "f:2: rule no-such-rule",
      "f:3: path",
      "f:4: something else",
    ]);
  });
});

describe("getAgentsSection", () => {
  it("returns the list under the heading up to the next heading of level two or above, at its own line numbers", () => {
    const agents = "# Rules\n\n## Quality review exceptions\n\n- path legacy/**\n### Detail\n- QR-1a2b3c4d\n## Other\n- path x/**\n";
    expect(getAgentsSection(agents)).toBe("\n\n\n\n- path legacy/**\n### Detail\n- QR-1a2b3c4d");
  });

  it("is empty without the heading", () => {
    expect(getAgentsSection("# Rules\n\n## Other\n")).toBe("");
  });
});

describe("matchesGlob", () => {
  it("matches ** across folders, * within a segment and ? for one character", () => {
    expect(matchesGlob("legacy/a/b.ts", "legacy/**")).toBe(true);
    expect(matchesGlob("src/a.ts", "src/**/*.ts")).toBe(true);
    expect(matchesGlob("src/x/y/a.ts", "src/**/*.ts")).toBe(true);
    expect(matchesGlob("src/x/a.ts", "src/*.ts")).toBe(false);
    expect(matchesGlob("src/a1.ts", "src/a?.ts")).toBe(true);
    expect(matchesGlob("srcXa.ts", "src.a.ts")).toBe(false);
  });
});

describe("applyIgnoreRules", () => {
  it("drops the findings an exception covers and keeps the rest", () => {
    const { findings } = extractFindings(
      [
        toBlock(makeAgentFinding({ file: "src/a.ts", symbol: "a" })),
        toBlock(makeAgentFinding({ category: "dead-code", rule: "unused-export", severity: "suggestion", file: "src/sdk/x.ts", symbol: "x" })),
        toBlock(makeAgentFinding({ file: "legacy/old.ts", symbol: "old" })),
        toBlock(makeAgentFinding({ file: "src/b.ts", symbol: "b" })),
      ].join(""),
    );
    const byId = findings[0]?.id ?? "";
    const { rules } = parseIgnoreLines(`${byId}\nrule unused-export src/sdk/**\npath legacy/**`, "f");
    const result = applyIgnoreRules(findings, rules);
    expect(result.findings.map((finding) => finding.file)).toEqual(["src/b.ts"]);
    expect(result.ignored.map((finding) => finding.file)).toEqual(["src/a.ts", "src/sdk/x.ts", "legacy/old.ts"]);
  });
});

describe("readIgnoreRules", () => {
  it("reads both the ignore file and the AGENTS.md section", () => {
    const repo = makeRepo({
      "quality-review.ignore": "path legacy/**\n",
      "AGENTS.md": "# Rules\n\n## Quality review exceptions\n\n- `rule empty-test`\n- not a rule\n",
    });
    cleanup = repo.cleanup;
    const result = readIgnoreRules(repo.root);
    expect(result.rules.map((rule) => rule.kind)).toEqual(["path", "rule"]);
    expect(result.invalid).toEqual(["AGENTS.md (Quality review exceptions):6: not a rule"]);
  });

  it("is empty for a repository with neither", () => {
    const repo = makeRepo({ "README.md": "x" });
    cleanup = repo.cleanup;
    expect(readIgnoreRules(repo.root)).toEqual({ rules: [], invalid: [] });
  });
});
