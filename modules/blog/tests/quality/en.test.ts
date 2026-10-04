// The English ruleset: a careful text passes; an AI-sounding one names its habits. Same shape as the
// Polish baseline, with generic settings (no FIRE options).
import { readFileSync } from "node:fs";
import { checkArticleText, qualityOptionsSchema, resolveQualitySettings, type QualityFinding, type QualityOptionsInput } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const MODEL = readFileSync(new URL("./fixtures/index-funds.txt", import.meta.url), "utf8");
const AI_TEXT = readFileSync(new URL("./fixtures/ai-sounding.txt", import.meta.url), "utf8");

/** The fixtures are short; the length limits are FIRE's long-form defaults otherwise. */
const SHORT_TEXTS: QualityOptionsInput = { limits: { words: { article: { min: 150 } } } };

function check(text: string, fileName: string, options: QualityOptionsInput = {}): readonly QualityFinding[] {
  const settings = resolveQualitySettings(qualityOptionsSchema.parse({ ...SHORT_TEXTS, ...options }), { appOrigin: "https://example.com", timezone: "UTC" });
  const targets = new Set(["/calculator", "/blog/glossary/expense-ratio"]);
  return checkArticleText({ text, fileName, settings, today: "2026-10-03", resolveInternalLink: (pathname) => targets.has(pathname) }).findings;
}

function rulesOf(findings: readonly QualityFinding[], severity: QualityFinding["severity"] = "error"): string[] {
  return [...new Set(findings.filter((finding) => finding.severity === severity).map((finding) => finding.rule))].sort();
}

describe("the English ruleset", () => {
  it("passes the model text with the default settings and with YMYL on", () => {
    expect(check(MODEL, "index-funds.md")).toEqual([]);
    expect(check(MODEL, "index-funds.md", { ymyl: { ownCalculationMark: "our calculation" } })).toEqual([]);
  });

  it("names every habit of the AI-sounding text", () => {
    expect(rulesOf(check(AI_TEXT, "ai-sounding.md", { ymyl: true, voice: { forbidFirstPersonSingular: true } }))).toEqual(
      [
        "announcement",
        "crucial",
        "dashes",
        "empty-conclusion",
        "emoji",
        "first-person-singular",
        "internal-links",
        "lead",
        "length",
        "meta-commentary",
        "not-only-but-also",
        "not-x-but-y",
        "number-source",
        "plays-a-role",
        "profit-promise",
        "puffery",
        "section-question",
        "sources-missing",
        "summary-missing",
        "these-days",
      ].sort(),
    );
  });

  it("leaves voice and YMYL rules out unless the app switches them on", () => {
    const rules = rulesOf(check(AI_TEXT, "ai-sounding.md"));
    expect(rules).not.toContain("first-person-singular");
    expect(rules).not.toContain("profit-promise");
    expect(rules).not.toContain("sources-missing");
  });

  it("reads English number notation: amounts with $ and thousands commas need a source under YMYL", () => {
    const text = MODEL.replace("Most broad index funds charge between 0.03% and 0.2% a year[^sec].", "Most broad index funds charge between 0.03% and 0.2% a year.");
    expect(rulesOf(check(text, "index-funds.md", { ymyl: { ownCalculationMark: "our calculation" } }))).toEqual(["number-source"]);
    const noMark = check(MODEL, "index-funds.md", { ymyl: true });
    expect(rulesOf(noMark)).toEqual(["footnote-source"]);
  });

  it("flags a link to a glossary term that does not exist", () => {
    const findings = check(MODEL.replace("/blog/glossary/expense-ratio", "/blog/glossary/ter"), "index-funds.md");
    expect(findings).toEqual([{ rule: "internal-link-target", severity: "error", message: "an internal link leads nowhere: /blog/glossary/ter", line: 30 }]);
  });

  it("flags a heading that skips a level and an H1 in the body", () => {
    const text = MODEL.replace("## When is a higher fee worth it?", "#### When is a higher fee worth it?").replace("The difference comes from compounding.", "# Fees\n\nThe difference comes from compounding.");
    expect(rulesOf(check(text, "index-funds.md"))).toEqual(["heading-h1", "heading-order"]);
  });
});
