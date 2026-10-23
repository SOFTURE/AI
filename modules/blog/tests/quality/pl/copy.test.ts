// checkCopyText (#690) with the Polish ruleset: the rules measured on feedback to a launch post.
import { readFileSync } from "node:fs";
import { checkArticleText, checkCopyText, qualityOptionsSchema, resolveQualitySettings, type QualityFinding } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const MODEL = readFileSync(new URL("./fixtures/model.txt", import.meta.url), "utf8");
const quality = { language: "pl" } as const;

function rulesOf(findings: readonly QualityFinding[]): string[] {
  return findings.map((finding) => `${finding.rule}:${finding.severity}`);
}

describe("the bare contrast", () => {
  it("is an error in copy and a warning in an article", () => {
    const sentence = "Liczy się nie cena, tylko czas.";
    expect(rulesOf(checkCopyText(sentence, { quality }).findings)).toEqual(["not-x-but-y-bare:error"]);
    const settings = resolveQualitySettings(qualityOptionsSchema.parse(quality), { appOrigin: "https://example.com", timezone: "UTC" });
    const findings = checkArticleText({ text: MODEL.replace("\n---\n\n", `\n---\n\n${sentence}\n\n`), fileName: "model.md", settings, today: "2026-10-23", parse: { fields: z.object({ scenario: z.string().optional() }) } }).findings;
    expect(findings.filter((finding) => finding.rule.startsWith("not-x")).map((finding) => `${finding.rule}:${finding.severity}`)).toEqual(["not-x-but-y-bare:warning"]);
  });

  it("catches the form with lecz", () => {
    expect(rulesOf(checkCopyText("Wygrywa nie szybkość, lecz cierpliwość.", { quality }).findings)).toEqual(["not-x-but-y-bare:error"]);
  });

  it("leaves the forms other rules catch to them, one finding per phrase", () => {
    expect(rulesOf(checkCopyText("To nie jest konto, tylko styl życia.", { quality }).findings)).toEqual(["not-x-but-y:error"]);
    expect(rulesOf(checkCopyText("Nie chodzi o cenę, tylko o czas.", { quality }).findings)).toEqual(["not-x-but-y:error"]);
    expect(rulesOf(checkCopyText("Konto jest nie tylko tanie, ale także proste.", { quality }).findings)).toEqual(["not-only-but-also:error"]);
  });
});

describe("the new Polish rules", () => {
  it("flags a verdict label at a sentence start, not the word inside a sentence", () => {
    expect(rulesOf(checkCopyText("Liczby są jasne. Wniosek: oszczędzaj.", { quality }).findings)).toEqual(["verdict-label:error"]);
    expect(rulesOf(checkCopyText("Sedno: koszt.", { quality }).findings)).toEqual(["verdict-label:error"]);
    expect(checkCopyText("Ten wniosek: złożony wczoraj, przyjęty dziś.", { quality }).findings).toEqual([]);
  });

  it("flags the fragile-spot family in its declined forms", () => {
    for (const text of ["To najkruchsze miejsce planu.", "Opłaty są najsłabszym ogniwem.", "To pięta achillesowa funduszu.", "Uderza w piętę achillesową planu."]) {
      expect(rulesOf(checkCopyText(text, { quality }).findings)).toEqual(["fragile-spot:error"]);
    }
  });

  it("finds Polish dash pivots and stacked asides in a post", () => {
    expect(rulesOf(checkCopyText("Opłata wygląda na małą — nie jest.", { quality }).findings)).toEqual(["dash-pivot:error"]);
    expect(rulesOf(checkCopyText("Opłata (płacona co roku) zjada zysk (i procent składany).", { quality }).findings)).toEqual(["stacked-asides:error"]);
    expect(checkCopyText("Wzór to K × (1 + r/m)^(m × n), więc kwota rośnie co roku.", { quality }).findings).toEqual([]);
    expect(checkCopyText("Kupuj (w z) i trzymaj (i w).", { quality }).findings).toEqual([]);
  });

  it("flags markdown of a forum post in channel mode", () => {
    expect(rulesOf(checkCopyText("## Dlaczego opłaty\n\nOpłaty są **niskie**.", { quality, mode: "channel" }).findings)).toEqual(["channel-markup:error", "channel-markup:error"]);
  });
});
