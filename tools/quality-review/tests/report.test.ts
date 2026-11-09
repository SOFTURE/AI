import { describe, expect, it } from "vitest";
import { extractFindings, type Finding } from "../src/findings.js";
import { REPORT_MARKER, parseReport, renderReport, type Report } from "../src/report.js";
import { makeAgentFinding, toBlock } from "./fixtures.js";

function makeFindings(): Finding[] {
  return extractFindings(
    [
      toBlock(makeAgentFinding({ severity: "suggestion", category: "dead-code", rule: "unused-export", file: "src/z.ts", line: 9, symbol: "old", problem: "Exported | never imported." })),
      toBlock(makeAgentFinding({ severity: "warning", category: "errors", rule: "missing-timeout", file: "src/client.ts", line: 4, symbol: "fetchRates" })),
      toBlock(makeAgentFinding({ severity: "critical", file: "src/actions.ts", line: 3, problem: "No ownership\ncheck." })),
      toBlock(makeAgentFinding({ severity: "suggestion", category: "tests", rule: "empty-test", file: "src/a.test.ts", line: 2, symbol: "" })),
    ].join(""),
  ).findings;
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    header: {
      date: "2026-11-09T10:00:00Z",
      commit: "0123456789abcdef0123456789abcdef01234567",
      model: "claude-opus-5-5",
      costUsd: 3.21,
      budgetUsd: 10,
      tokens: { input: 1200, output: 340, cacheRead: 56000, cacheWrite: 7800 },
      status: "complete",
      ignored: 1,
    },
    findings: makeFindings(),
    ...overrides,
  };
}

describe("renderReport", () => {
  it("writes the header with the date, commit, model, cost, tokens and counts", () => {
    const markdown = renderReport(makeReport());
    expect(markdown).toContain(REPORT_MARKER);
    expect(markdown).toContain("| Date | 2026-11-09T10:00:00Z |");
    expect(markdown).toContain("| Commit | `0123456789abcdef0123456789abcdef01234567` |");
    expect(markdown).toContain("| Model | claude-opus-5-5 |");
    expect(markdown).toContain("| Cost | 3.2100 USD of a 10.00 USD budget |");
    expect(markdown).toContain("| Tokens | input 1200, output 340, cache read 56000, cache write 7800 |");
    expect(markdown).toContain("| Status | complete |");
    expect(markdown).toContain("| Findings | 1 critical, 1 warning, 2 suggestion |");
    expect(markdown).toContain("| Ignored | 1 |");
  });

  it("lists critical findings first, then warnings in full, and groups suggestions in one table at the end", () => {
    const markdown = renderReport(makeReport());
    const critical = markdown.indexOf("## Critical");
    const warnings = markdown.indexOf("## Warnings");
    const suggestions = markdown.indexOf("## Suggestions");
    expect(critical).toBeGreaterThan(0);
    expect(warnings).toBeGreaterThan(critical);
    expect(suggestions).toBeGreaterThan(warnings);
    expect(markdown.slice(critical, warnings)).toContain("- Location: `src/actions.ts:3`");
    expect(markdown.slice(critical, warnings)).toContain("- Problem: No ownership check.");
    expect(markdown.slice(warnings, suggestions)).toContain("- Rule: missing-timeout");
    expect(markdown.slice(suggestions)).toContain("| ID | Category | Rule | Location | Symbol | Title | Problem | Impact | Fix |");
    expect(markdown.slice(suggestions)).toContain("Exported \\| never imported.");
    expect(markdown.slice(suggestions).indexOf("src/a.test.ts")).toBeLessThan(markdown.slice(suggestions).indexOf("src/z.ts"));
  });

  it("says when a complete run found nothing, and writes None. in each section", () => {
    const markdown = renderReport(makeReport({ findings: [], header: { ...makeReport().header, ignored: 0 } }));
    expect(markdown).toContain("No findings: the review found nothing to report at this commit.");
    expect(markdown.match(/^None\.$/gm)).toHaveLength(3);
  });

  it("warns that a stopped run did not cover the whole repository", () => {
    const markdown = renderReport(makeReport({ header: { ...makeReport().header, status: "budget" } }));
    expect(markdown).toContain("| Status | stopped at the budget |");
    expect(markdown).toContain("> The run stopped at the budget before it covered the whole repository");
    expect(markdown).not.toContain("No findings");
  });
});

describe("parseReport", () => {
  it("reads back exactly what renderReport wrote", () => {
    const report = makeReport();
    const parsed = parseReport(renderReport(report));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.report.header).toEqual(report.header);
    const normalized = report.findings.map((finding) => ({ ...finding, problem: finding.problem.replace(/\s+/g, " ") }));
    expect([...parsed.report.findings].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...normalized].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("reads a report without findings and a stopped one", () => {
    expect(parseReport(renderReport(makeReport({ findings: [] }))).ok).toBe(true);
    expect(parseReport(renderReport(makeReport({ header: { ...makeReport().header, status: "turns" } }))).ok).toBe(true);
  });

  it("refuses a file without the format marker", () => {
    expect(parseReport("# Quality report\n")).toEqual({ ok: false, errors: [`the format marker ${REPORT_MARKER} is missing`] });
  });

  it("names every problem of a report edited by hand", () => {
    const markdown = renderReport(makeReport())
      .replace("| Status | complete |", "| Status | done |")
      .replace("- Severity: critical", "- Severity: warning")
      .replace("- Rule: missing-timeout", "- Rule: unsafe-sql")
      .replace("- Location: `src/actions.ts:3`", "- Location: src/actions.ts")
      .replace(/### (QR-[0-9a-f]{8}): deleteProject/, "### QR-00000000: deleteProject");
    const parsed = parseReport(markdown);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        'header: unknown Status "done"',
        'QR-00000000: severity "warning" in the Critical section',
        "QR-00000000: location is not file:line",
        expect.stringMatching(/^QR-[0-9a-f]{8}: rule "unsafe-sql" is not a rule of errors$/),
      ]),
    );
  });

  it("refuses an id that its rule, file and symbol do not give, and counts that do not match", () => {
    const report = makeReport();
    const id = report.findings.find((finding) => finding.severity === "warning")?.id ?? "";
    const markdown = renderReport(report)
      .replace(`### ${id}:`, "### QR-ffffffff:")
      .replace("| Findings | 1 critical, 1 warning, 2 suggestion |", "| Findings | 1 critical, 2 warning, 2 suggestion |");
    const parsed = parseReport(markdown);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual([
      `QR-ffffffff: the id is not the one its rule, file and symbol give (${id})`,
      'header: Findings says "1 critical, 2 warning, 2 suggestion", the report lists "1 critical, 1 warning, 2 suggestion"',
    ]);
  });

  it("refuses a missing section", () => {
    const markdown = renderReport(makeReport({ findings: [] })).replace(/## Warnings\n\nNone\.\n\n/, "");
    const parsed = parseReport(markdown);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toContain("the Warnings section is missing");
  });
});
