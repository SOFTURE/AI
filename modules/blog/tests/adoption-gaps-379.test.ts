// Issue #379: a fact rule reads the value its pattern captures (group 1), checks every year the sentence
// names, and can warn when no year of the sentence has known values.
import { readFileSync } from "node:fs";
import { checkArticleText, factRule, qualityOptionsSchema, resolveQualitySettings, type FactRuleInput } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const MODEL = readFileSync(new URL("./quality/fixtures/index-funds.txt", import.meta.url), "utf8");
/** Line 22 of the model text. */
const LINE_22 = "Most broad index funds charge between 0.03% and 0.2% a year[^sec].";
const LIMITS: Record<number, readonly number[]> = { 2025: [23_475], 2026: [26_019] };

function limitRule(patterns: readonly RegExp[], extra: Partial<FactRuleInput> = {}) {
  return factRule({ id: "ike-limit", description: "the yearly IKE limit", patterns: [...patterns], allowedValues: (year) => LIMITS[year], ...extra });
}

/** The findings of the fact rule on the model text whose line 22 is `sentence`. */
function check(rule: FactRuleInput, sentence: string) {
  const options = qualityOptionsSchema.parse({ limits: { words: { article: { min: 150 } } }, facts: [rule] });
  const settings = resolveQualitySettings(options, { appOrigin: "https://example.com", timezone: "UTC" });
  const text = MODEL.replace(LINE_22, sentence);
  return checkArticleText({ text, fileName: "index-funds.md", settings, today: "2026-10-03" }).findings.filter((finding) => finding.rule === "ike-limit");
}

const CAPTURED = /IKE limit\D*(\d.*)/gi;

describe("the value of a fact rule (#379, 1)", () => {
  it("reads the first number of group 1 when the pattern captures, not the first number of the sentence", () => {
    expect(check(limitRule([CAPTURED]), "Paying in 1,000 a month keeps you under the IKE limit of 26,019.")).toEqual([]);
    expect(check(limitRule([CAPTURED]), "Paying in 1,000 a month keeps you under the IKE limit of 25,000.")).toEqual([
      { rule: "ike-limit", severity: "error", message: "the yearly IKE limit: 25,000 does not match the 2026 value (26019)", line: 22 },
    ]);
  });

  it("skips years in group 1, so the value after a year is read", () => {
    expect(check(limitRule([CAPTURED]), "The IKE limit for 2025 was 23,475.")).toEqual([]);
  });

  it("leaves the sentence unchecked when group 1 does not take part or holds no number", () => {
    const optional = /IKE limit(?:\D*(\d.*))?/i;
    expect(check(limitRule([optional]), "Paying in 1,000 a month, you will not reach the IKE limit.")).toEqual([]);
    expect(check(limitRule([/IKE (limit)/i]), "Paying in 1,000 a month, you will not reach the IKE limit.")).toEqual([]);
  });

  it("reads the first number of the sentence when the pattern has no group, as before", () => {
    expect(check(limitRule([/IKE limit/i]), "Paying in 1,000 a month, you will not reach the IKE limit.")).toEqual([
      { rule: "ike-limit", severity: "error", message: "the yearly IKE limit: 1,000 does not match the 2026 value (26019)", line: 22 },
    ]);
  });

  it("takes the first pattern whose group holds a number", () => {
    expect(check(limitRule([/IKE (rules)/i, CAPTURED]), "Under the IKE rules, 1,000 a month stays below the IKE limit of 26,019.")).toEqual([]);
  });

  it("leaves a capturing regular expression with a g flag usable for the next sentence", () => {
    const sentence = "The IKE limit is 26,019. The IKE limit is 25,000.";
    expect(check(limitRule([CAPTURED]), sentence).map((finding) => finding.message)).toEqual(["the yearly IKE limit: 25,000 does not match the 2026 value (26019)"]);
  });
});

describe("the years of a fact sentence (#379, 2)", () => {
  it("passes a value of any year the sentence names", () => {
    expect(check(limitRule([CAPTURED]), "Between 2025 and 2026 the IKE limit rose to 26,019.")).toEqual([]);
    expect(check(limitRule([CAPTURED]), "Between 2025 and 2026 the IKE limit was 23,475 at first.")).toEqual([]);
  });

  it("names every known year when the value matches none", () => {
    expect(check(limitRule([CAPTURED]), "Between 2025 and 2031 the IKE limit was 30,000.")).toEqual([
      { rule: "ike-limit", severity: "error", message: "the yearly IKE limit: 30,000 does not match the 2025 value (23475)", line: 22 },
    ]);
    expect(check(limitRule([CAPTURED]), "Between 2025 and 2026 the IKE limit was 30,000.")).toEqual([
      { rule: "ike-limit", severity: "error", message: "the yearly IKE limit: 30,000 does not match the 2025 value (23475) or the 2026 value (26019)", line: 22 },
    ]);
  });

  it("skips a sentence about a year without values by default and with onUnknownYear skip", () => {
    expect(check(limitRule([CAPTURED]), "The IKE limit for 2031 is 40,000.")).toEqual([]);
    expect(check(limitRule([CAPTURED], { onUnknownYear: "skip" }), "The IKE limit for 2031 is 40,000.")).toEqual([]);
  });

  it("warns about a sentence none of whose years has values with onUnknownYear warn", () => {
    expect(check(limitRule([CAPTURED], { onUnknownYear: "warn" }), "The IKE limit for 2031 is 40,000.")).toEqual([
      { rule: "ike-limit", severity: "warning", message: "the yearly IKE limit: no value known for 2031, 40,000 not checked", line: 22 },
    ]);
    expect(check(limitRule([CAPTURED], { onUnknownYear: "warn" }), "For 2030 and 2031 the IKE limit is 40,000.")).toEqual([
      { rule: "ike-limit", severity: "warning", message: "the yearly IKE limit: no value known for 2030, 2031, 40,000 not checked", line: 22 },
    ]);
  });

  it("refuses an onUnknownYear outside warn and skip", () => {
    const rule = { ...limitRule([CAPTURED]), onUnknownYear: "error" };
    expect(qualityOptionsSchema.safeParse({ facts: [rule] }).success).toBe(false);
  });
});
