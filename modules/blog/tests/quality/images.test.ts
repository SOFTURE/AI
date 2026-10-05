// The image rules of the gate (BF-3): the renderer's image policy, reported with file lines, so a text
// whose image the page would drop never goes public. An image is not a link.
import { readFileSync } from "node:fs";
import { checkArticleText, getQualitySettings, qualityOptionsSchema, resolveQualitySettings, type ArticleImagePolicy, type QualityFinding } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { createConfig } from "../support.js";

const MODEL = readFileSync(new URL("./fixtures/index-funds.txt", import.meta.url), "utf8");
const POLICY: ArticleImagePolicy = { hosts: ["cdn.example.com"], dimensions: (src) => (src === "/images/fees.png" ? { width: 800, height: 450 } : null) };
const ANCHOR = "## What does an index fund charge?\n";

/** The model text with lines added right under its first question heading. */
function withLines(...lines: string[]): string {
  return MODEL.replace(ANCHOR, `${ANCHOR}\n${lines.join("\n")}\n`);
}

/** The file line of the first added line. */
const FIRST_ADDED_LINE = MODEL.slice(0, MODEL.indexOf(ANCHOR)).split("\n").length + 2;

function check(text: string, policy: ArticleImagePolicy | null): QualityFinding[] {
  const options = qualityOptionsSchema.parse({ limits: { words: { article: { min: 150 } } } });
  const settings = resolveQualitySettings(options, { appOrigin: "https://example.com", timezone: "UTC" }, policy);
  const targets = new Set(["/calculator", "/blog/glossary/expense-ratio"]);
  return [...checkArticleText({ text, fileName: "index-funds.md", settings, today: "2026-10-03", resolveInternalLink: (pathname) => targets.has(pathname) }).findings];
}

describe("the image rules", () => {
  it("pass an image that follows the policy, and it is no internal link", () => {
    expect(check(withLines("![Fees over 20 years](/images/fees.png)"), POLICY)).toEqual([]);
  });

  it("report a refused source, a missing alt and an unknown size at the image's line", () => {
    const text = withLines("![Fees](https://evil.test/fees.png)", "", "![](/images/fees.png)", "", "![Old chart](/images/old.png)");
    expect(check(text, POLICY)).toEqual([
      { rule: "image-source", severity: "error", message: "an image from outside the site and the allowed hosts (blog({ images: { hosts } })): https://evil.test/fees.png", line: FIRST_ADDED_LINE },
      { rule: "image-alt", severity: "error", message: "an image without alt text; describe what it shows: /images/fees.png", line: FIRST_ADDED_LINE + 2 },
      { rule: "image-dimensions", severity: "error", message: "the app does not know the width and height of an image (blog({ images: { dimensions } })): /images/old.png", line: FIRST_ADDED_LINE + 4 },
    ]);
  });

  it("refuse every image while the app has no image policy", () => {
    expect(check(withLines("![Fees](/images/fees.png)"), null)).toEqual([
      { rule: "image-source", severity: "error", message: "images are off until the app sets blog({ images }): /images/fees.png", line: FIRST_ADDED_LINE },
    ]);
  });

  it("report an image whose scheme the renderer keeps as text", () => {
    expect(check(withLines("![x](javascript:alert(1))"), POLICY).map((finding) => finding.rule)).toEqual(["image-source"]);
  });

  it("ignore images in code", () => {
    expect(check(withLines("`![x](/images/old.png)`"), POLICY)).toEqual([]);
  });

  it("turn a throwing size resolver into a finding instead of a crash", () => {
    const policy: ArticleImagePolicy = {
      dimensions: () => {
        throw new Error("manifest missing");
      },
    };
    expect(check(withLines("![Fees](/images/fees.png)"), policy)).toEqual([
      { rule: "image-dimensions", severity: "error", message: "the image dimensions resolver failed (manifest missing): /images/fees.png", line: FIRST_ADDED_LINE },
    ]);
  });

  it("take the policy from blog({ images }) through the app config", () => {
    expect(getQualitySettings(createConfig({ images: POLICY }))?.images).toEqual({ hosts: ["cdn.example.com"], dimensions: POLICY.dimensions });
    expect(getQualitySettings(createConfig())?.images).toBeNull();
  });
});
