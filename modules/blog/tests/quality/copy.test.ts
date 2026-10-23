// checkCopyText (#690): the voice check for copy that is not an article, in its two modes.
import { readFileSync } from "node:fs";
import { checkArticleText, checkCopyText, qualityOptionsSchema, resolveQualitySettings, wordPattern, type QualityFinding, type QualityOptionsInput } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const MODEL = readFileSync(new URL("./fixtures/index-funds.txt", import.meta.url), "utf8");

const CLEAN = [
  "Index funds hold every stock of a market, so their cost is mostly the fee.",
  "",
  "A fund that charges 0.2% a year leaves more of the return with you than one that charges 1%. Over thirty years the gap grows.",
].join("\n");

function rulesOf(findings: readonly QualityFinding[]): string[] {
  return findings.map((finding) => `${finding.rule}:${finding.severity}`);
}

describe("checkCopyText in copy mode", () => {
  it("passes clean copy without a finding", () => {
    expect(checkCopyText(CLEAN).findings).toEqual([]);
    expect(checkCopyText(CLEAN, { mode: "channel" }).findings).toEqual([]);
  });

  it("reports ruleset errors with the line of the text and warnings once with a count", () => {
    const text = "Fees are low.\n\nFees are crucial.\n\nMoreover, fees add up. Moreover, they compound.";
    expect(checkCopyText(text).findings).toEqual([
      { rule: "crucial", severity: "error", message: '"crucial": a favourite word of language models; name what depends on the thing', line: 3 },
      { rule: "filler-words", severity: "warning", message: '2x (e.g. "Moreover"): a filler word; check whether the sentence says the same without it', line: 5 },
    ]);
  });

  it("reads markdown in copy mode as prose and flags none of it", () => {
    expect(checkCopyText("Fees are [low](https://example.com).\n\n- one fund\n- two funds").findings).toEqual([]);
  });

  it("applies the app's voice, YMYL and severity overrides from the same quality options as blog()", () => {
    const quality: QualityOptionsInput = {
      ymyl: true,
      voice: { forbidFirstPersonSingular: true, phrases: [{ id: "brand-cliche", pattern: wordPattern("money tree"), message: "say what happens" }] },
      severity: { crucial: "off", exclamation: "error" },
    };
    const text = "My money tree is crucial. These are guaranteed returns! Buy now.";
    expect(rulesOf(checkCopyText(text, { quality }).findings).sort()).toEqual(["brand-cliche:error", "exclamation:error", "first-person-singular:error", "profit-promise:error"]);
  });

  it("runs the rhythm rules over the copy", () => {
    const text = "Fees add up. Fees compound. Fees never stop. Pick a cheap fund.";
    expect(rulesOf(checkCopyText(text).findings)).toEqual(["repeated-openings:warning"]);
  });

  it("refuses invalid quality options like blog() does", () => {
    expect(() => checkCopyText(CLEAN, { quality: { language: "de" } as never })).toThrow();
  });
});

describe("stacked asides", () => {
  const twoInOneSentence = "The fee (paid every year) eats the return (and the compounding on it) over time.";

  it("is an error in copy and a warning in an article", () => {
    expect(rulesOf(checkCopyText(twoInOneSentence).findings)).toEqual(["stacked-asides:error"]);
    const settings = resolveQualitySettings(qualityOptionsSchema.parse({}), { appOrigin: "https://example.com", timezone: "UTC" });
    const article = MODEL.replace("\n---\n\n", `\n---\n\n${twoInOneSentence}\n\n`);
    const findings = checkArticleText({ text: article, fileName: "index-funds.md", settings, today: "2026-10-23" }).findings;
    expect(findings.filter((finding) => finding.rule === "stacked-asides").map((finding) => finding.severity)).toEqual(["warning"]);
  });

  it("does not count asides without two words: numbers, years, acronyms, bare links", () => {
    expect(checkCopyText("The fee (0.2%) of the fund (ETF) since (2024) is low (https://example.com).").findings).toEqual([]);
  });

  it("flags three worded asides in a short post, even one per sentence", () => {
    const post = "Fees matter (more than you think). Pick a fund (any broad one). Hold it (for decades).";
    expect(checkCopyText(post).findings).toEqual([{ rule: "stacked-asides", severity: "error", message: "3 worded asides in parentheses in a post of 16 words; keep at most two, and fold the rest into sentences" }]);
  });

  it("does not count asides per post in a long text", () => {
    const sentence = "Pick a broad fund with a low yearly fee and keep buying it every month for a very long time.";
    const long = [`Fees matter (more than you think).`, `Pick a fund (any broad one).`, `Hold it (for decades).`, ...Array<string>(20).fill(sentence)].join(" ");
    expect(rulesOf(checkCopyText(long).findings).filter((rule) => rule.startsWith("stacked-asides"))).toEqual([]);
  });
});

describe("dash pivots", () => {
  it("flags a spaced em or en dash between words in copy", () => {
    expect(checkCopyText("Fees look small — they are not.").findings).toEqual([
      { rule: "dash-pivot", severity: "error", message: '"small — they": a dash as a pivot between two thoughts; use a full stop, a comma or a colon', line: 1 },
    ]);
    expect(rulesOf(checkCopyText("Fees look small – they are not.").findings)).toEqual(["dash-pivot:error"]);
  });

  it("leaves a range between numbers and a hyphenated word alone", () => {
    expect(checkCopyText("Between 2020 – 2024 the fee fell. A low-cost fund.\n\nPages 10—12.").findings).toEqual([]);
  });
});

describe("checkCopyText in channel mode", () => {
  it("reports each kind of markup once, with its first line", () => {
    const text = [
      "## Why fees matter",
      "Fees are **low** and *steady*.",
      "See [the fund](https://example.com) and ![a chart](/chart.png).",
      "> Quoted text.",
      "| a | b |",
      "Run `npm ci` first.",
      "```",
      "code",
      "```",
      "---",
      "Some <b>bold</b> text and more **bold**.",
    ].join("\n");
    expect(checkCopyText(text, { mode: "channel" }).findings.filter((finding) => finding.rule === "channel-markup")).toEqual([
      { rule: "channel-markup", severity: "error", message: "a heading (\"## Why fees matter\"): a plain-text editor shows the markup as is; write it as plain text", line: 1 },
      { rule: "channel-markup", severity: "error", message: "bold (\"**low**\"): a plain-text editor shows the markup as is; write it as plain text", line: 2 },
      { rule: "channel-markup", severity: "error", message: "italics (\"*steady*\"): a plain-text editor shows the markup as is; write it as plain text", line: 2 },
      { rule: "channel-markup", severity: "error", message: "a bracket link (\"[the fund](https://example.com)\"): a plain-text editor shows the markup as is; write it as plain text", line: 3 },
      { rule: "channel-markup", severity: "error", message: "an embedded image (\"![a chart](/chart.png)\"): a plain-text editor shows the markup as is; write it as plain text", line: 3 },
      { rule: "channel-markup", severity: "error", message: "a quote (\"> Quoted text.\"): a plain-text editor shows the markup as is; write it as plain text", line: 4 },
      { rule: "channel-markup", severity: "error", message: "a table (\"| a | b |\"): a plain-text editor shows the markup as is; write it as plain text", line: 5 },
      { rule: "channel-markup", severity: "error", message: "inline code (\"`npm ci`\"): a plain-text editor shows the markup as is; write it as plain text", line: 6 },
      { rule: "channel-markup", severity: "error", message: "a code block (\"```\"): a plain-text editor shows the markup as is; write it as plain text", line: 7 },
      { rule: "channel-markup", severity: "error", message: "a horizontal rule (\"---\"): a plain-text editor shows the markup as is; write it as plain text", line: 10 },
      { rule: "channel-markup", severity: "error", message: "HTML (\"<b>\"): a plain-text editor shows the markup as is; write it as plain text", line: 11 },
    ]);
  });

  it("flags bold-label lists through their bold", () => {
    expect(rulesOf(checkCopyText("- **Cost:** low\n- **Risk:** market", { mode: "channel" }).findings)).toEqual(["channel-markup:error"]);
  });

  it("leaves bare URLs, dash and numbered lists, snake_case and list stars alone", () => {
    const text = "Read https://example.com/a_b_c first.\n\n- one fund\n- two funds\n* three funds\n1. buy\n2. hold\n\nThe file_name stays, and 2 * 3 is 6.";
    expect(checkCopyText(text, { mode: "channel" }).findings).toEqual([]);
  });

  it("checks the prose inside the markup too", () => {
    expect(rulesOf(checkCopyText("> Fees are crucial.", { mode: "channel" }).findings)).toEqual(["channel-markup:error", "crucial:error"]);
  });
});
