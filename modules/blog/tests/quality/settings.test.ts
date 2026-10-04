// Options of the gate: severity overrides, rule plugins and their failures, the rule catalog for the
// writing skill, and the options it refuses.
import { readFileSync } from "node:fs";
import { blog } from "@softure-ai/blog";
import { checkArticleText, listQualityRules, qualityOptionsSchema, resolveQualitySettings, type QualityOptionsInput, type QualityPlugin } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const MODEL = readFileSync(new URL("./fixtures/index-funds.txt", import.meta.url), "utf8");

function settingsOf(options: QualityOptionsInput) {
  return resolveQualitySettings(qualityOptionsSchema.parse({ limits: { words: { article: { min: 150 } } }, ...options }), { appOrigin: "https://example.com", timezone: "UTC" });
}

function check(options: QualityOptionsInput, text = MODEL) {
  return checkArticleText({ text, fileName: "index-funds.md", settings: settingsOf(options), today: "2026-10-03" }).findings;
}

const shout: QualityPlugin = {
  name: "shout",
  rules: [{ id: "no-fees-word", severity: "warning", description: "the word fee is avoided" }],
  check: ({ blocks }) => blocks.filter((block) => block.text.includes("fee")).map((block) => ({ rule: "no-fees-word", severity: "warning", message: "says fee", line: block.line })),
};

describe("severity overrides", () => {
  it("raises, lowers and switches off a rule", () => {
    const text = MODEL.replace("Rarely.", "Rarely!");
    expect(check({}, text)).toEqual([expect.objectContaining({ rule: "exclamation", severity: "warning" })]);
    expect(check({ severity: { exclamation: "error" } }, text)).toEqual([expect.objectContaining({ rule: "exclamation", severity: "error" })]);
    expect(check({ severity: { exclamation: "off" } }, text)).toEqual([]);
  });
});

describe("rule plugins", () => {
  it("adds the plugin's findings, which overrides also reach", () => {
    expect(check({ plugins: [shout] }).length).toBeGreaterThan(0);
    expect(check({ plugins: [shout], severity: { "no-fees-word": "off" } })).toEqual([]);
  });

  it("refuses a finding of a rule the plugin does not declare", () => {
    const sloppy: QualityPlugin = { ...shout, rules: [] };
    expect(check({ plugins: [sloppy] })[0]).toEqual({ rule: "plugin-rule-undeclared", severity: "error", message: "plugin shout reported rule no-fees-word, which it does not declare", line: 18 });
  });

  it("turns a throwing plugin into an error finding instead of crashing", () => {
    const broken: QualityPlugin = { ...shout, check: () => { throw new Error("table missing"); } };
    expect(check({ plugins: [broken] })).toEqual([{ rule: "plugin-failed", severity: "error", message: "plugin shout failed: table missing" }]);
  });
});

describe("listQualityRules", () => {
  it("lists the rules of the settings with their effective severity", () => {
    const ids = (options: QualityOptionsInput) => listQualityRules(settingsOf(options)).map((rule) => rule.id);
    expect(ids({})).toContain("crucial");
    expect(ids({})).not.toContain("profit-promise");
    expect(ids({})).not.toContain("title-case-heading");
    expect(ids({ language: "pl" })).toContain("title-case-heading");
    expect(ids({ ymyl: true })).toContain("number-source");
    expect(ids({ voice: { forbidFirstPersonSingular: true } })).toContain("first-person-singular");
    expect(ids({ plugins: [shout] })).toEqual(expect.arrayContaining(["no-fees-word", "plugin-failed"]));
    expect(ids({ severity: { crucial: "off" } })).not.toContain("crucial");
    expect(listQualityRules(settingsOf({ severity: { stale: "error" } })).find((rule) => rule.id === "stale")?.severity).toBe("error");
  });

  it("names every rule once", () => {
    const ids = listQualityRules(settingsOf({ language: "pl", ymyl: true, voice: { forbidFirstPersonSingular: true }, plugins: [shout] })).map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("blog({ quality })", () => {
  it("takes false to turn the gate off", () => {
    expect(blog({ quality: false }).options.quality).toBe(false);
  });

  it("refuses options it cannot use", () => {
    expect(() =>
      blog({
        quality: {
          // @ts-expect-error: no such ruleset.
          language: "de",
          voice: { phrases: [{ id: "bad", pattern: "(unclosed", message: "x" }] },
          limits: { words: { article: { min: 900, max: 800 } } },
          // @ts-expect-error: a plugin needs rules and check.
          plugins: [{ name: "half" }],
        },
      }),
    ).toThrow(/quality\.language[\s\S]*must be a valid regular expression[\s\S]*min must not exceed max[\s\S]*must be a plugin/);
  });
});
