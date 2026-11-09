import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_RULES, RULES, dedupeFindings, extractFindings, getFindingId } from "../src/findings.js";
import { makeAgentFinding, toBlock } from "./fixtures.js";

describe("the rule list", () => {
  it("lists every category and every rule of the category map", () => {
    expect(CATEGORIES).toEqual(Object.keys(CATEGORY_RULES));
    expect(RULES).toEqual(Object.values(CATEGORY_RULES).flat());
  });
});

describe("getFindingId", () => {
  it("is QR- and 8 hex digits, the same whatever the line or a leading ./", () => {
    const id = getFindingId({ rule: "unsafe-sql", file: "src/db.ts", symbol: "findUser" });
    expect(id).toMatch(/^QR-[0-9a-f]{8}$/);
    expect(getFindingId({ rule: "unsafe-sql", file: "./src/db.ts", symbol: " findUser " })).toBe(id);
  });

  it("differs when the rule, the file or the symbol differs", () => {
    const base = { rule: "unsafe-sql" as const, file: "src/db.ts", symbol: "findUser" };
    const id = getFindingId(base);
    expect(getFindingId({ ...base, rule: "swallowed-error" })).not.toBe(id);
    expect(getFindingId({ ...base, file: "src/other.ts" })).not.toBe(id);
    expect(getFindingId({ ...base, symbol: "findUsers" })).not.toBe(id);
  });
});

describe("extractFindings", () => {
  it("reads every finding block of the agent's text and gives each its id", () => {
    const text = `Checked the actions.\n${toBlock(makeAgentFinding())}\nmore\n${toBlock(makeAgentFinding({ file: "./src/b.ts", symbol: "" }))}`;
    const { findings, rejected } = extractFindings(text);
    expect(rejected).toEqual([]);
    expect(findings.map((finding) => [finding.file, finding.id])).toEqual([
      ["src/actions.ts", getFindingId({ rule: "missing-authorization", file: "src/actions.ts", symbol: "deleteProject" })],
      ["src/b.ts", getFindingId({ rule: "missing-authorization", file: "src/b.ts", symbol: "" })],
    ]);
  });

  it("rejects a block that is not JSON, misses a field, or names a rule of another category", () => {
    const missing = { ...makeAgentFinding(), fix: undefined };
    const text = [
      "<finding>{not json}</finding>",
      `<finding>${JSON.stringify(missing)}</finding>`,
      toBlock(makeAgentFinding({ category: "tests" })),
      toBlock(makeAgentFinding({ line: 0 })),
    ].join("\n");
    const { findings, rejected } = extractFindings(text);
    expect(findings).toEqual([]);
    expect(rejected).toEqual([
      "not JSON: {not json}",
      "not a finding (fix)",
      "not a finding (rule)",
      "not a finding (line)",
    ]);
  });

  it("returns nothing for text without blocks", () => {
    expect(extractFindings("Review complete: 0 findings.")).toEqual({ findings: [], rejected: [] });
  });
});

describe("dedupeFindings", () => {
  it("keeps the first finding of each id", () => {
    const { findings } = extractFindings(toBlock(makeAgentFinding({ line: 3 })) + toBlock(makeAgentFinding({ line: 7 })));
    expect(dedupeFindings(findings).map((finding) => finding.line)).toEqual([3]);
  });
});

describe("extractFindings on hostile text", () => {
  it("stays linear on many unclosed tags and keeps reading after them", () => {
    const text = "<finding>a".repeat(50000);
    const started = performance.now();
    expect(extractFindings(text)).toEqual({ findings: [], rejected: [] });
    expect(performance.now() - started).toBeLessThan(500);
  });
});
