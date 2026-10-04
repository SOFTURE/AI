// The baseline of BL-6: FIRE_TRACKER's fixtures (converted to the English frontmatter) give FIRE's
// findings through the `pl` ruleset plus FIRE's domain rules as plugins
// (FIRE `src/lib/blog/quality/check-article.test.ts`, `parse.test.ts`, `publish-gate.test.ts`).
import { readFileSync } from "node:fs";
import { createTestClock } from "@softure-ai/core";
import { checkArticleText, createQualityGate, hasQualityErrors, parseArticleFile, type CheckArticleTextInput, type QualityFinding } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createChartPlugin, createFireSettings, factsPlugin } from "./fire.js";

const MODEL = readFileSync(new URL("./fixtures/model.txt", import.meta.url), "utf8");
const AI_TEXT = readFileSync(new URL("./fixtures/ai-sounding.txt", import.meta.url), "utf8");
const FIELDS = z.object({ scenario: z.string().optional() });

function check(text: string, overrides: Partial<CheckArticleTextInput> = {}): readonly QualityFinding[] {
  return checkArticleText({
    text,
    fileName: "model.md",
    settings: createFireSettings(),
    today: "2026-10-03",
    resolveInternalLink: (pathname) => pathname === "/kalkulator",
    parse: { fields: FIELDS },
    ...overrides,
  }).findings;
}

function rulesOf(findings: readonly QualityFinding[], severity: QualityFinding["severity"] = "error"): string[] {
  return [...new Set(findings.filter((finding) => finding.severity === severity).map((finding) => finding.rule))].sort();
}

/** Replaces exactly one occurrence; a mutation that misses must fail, not pass quietly. */
function mutate(source: string, from: string, to: string): string {
  expect(source.split(from)).toHaveLength(2);
  return source.replace(from, to);
}

describe("the model text", () => {
  it("passes every rule without a single finding", () => {
    expect(check(MODEL)).toEqual([]);
  });

  it("reports the external source links for the network check", () => {
    const result = checkArticleText({ text: MODEL, fileName: "model.md", settings: createFireSettings(), today: "2026-10-03", parse: { fields: FIELDS } });
    expect(result.externalLinks.map((link) => link.url)).toEqual([
      "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WMP20250001202",
      "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20041161205",
    ]);
  });
});

describe("the AI-sounding text", () => {
  it("fails with every pattern the fixture plants (FIRE's rule ids mapped to English)", () => {
    const findings = check(AI_TEXT, { fileName: "ai-sounding.md" });
    expect(hasQualityErrors(findings)).toBe(true);
    expect(rulesOf(findings)).toEqual(
      [
        "these-days", // dzisiejsze-czasy
        "emoji",
        "fact-ike-limit", // fakt-limit-ike (plugin)
        "internal-links",
        "crucial", // kluczowy
        "lead",
        "length",
        "meta-commentary", // metakomentarz
        "dashes", // myslniki
        "puffery", // nadete-znaczenie
        "not-only-but-also", // nie-tylko-ale
        "number-source",
        "profit-promise", // obietnice-zysku
        "plays-a-role", // odgrywa-role
        "first-person-singular", // pierwsza-osoba
        "empty-conclusion", // podsumowujac
        "section-question", // sections-question
        "not-x-but-y", // to-nie-x-to-y
        "announcement", // warto-zauwazyc
        "summary-missing", // new in BL-6: the roadmap asks for a summary
      ].sort(),
    );
  });

  it("checks the title and description against the same patterns", () => {
    const messages = check(AI_TEXT, { fileName: "ai-sounding.md" }).map((finding) => finding.message);
    expect(messages).toContain('title, description or summary: "kompleksowy": an inflated or empty phrase; replace it with a fact');
  });
});

describe("legal facts through the facts plugin", () => {
  it("rejects an IKE limit other than the engine's", () => {
    const text = mutate(MODEL, "W 2026 roku na IKE wpłacisz najwyżej 28 260 zł", "Limit IKE na 2026 rok to 27 000 zł, więc wpłacisz najwyżej tyle");
    expect(check(text).find((finding) => finding.rule === "fact-ike-limit")).toMatchObject({
      severity: "error",
      message: "limit wpłat na IKE: the text says 27 000 zł, the engine 2026: 28 260 zł",
    });
  });

  it("accepts either IKZE limit (employee, business) and rejects a third", () => {
    const base = "Najpierw pełny limit tam, gdzie zysk po podatku jest większy w twojej sytuacji, potem drugie konto.";
    const say = (amount: string) => mutate(MODEL, base, `${base} Limit IKZE w 2026 roku to ${amount} zł[^ustawa].`);
    expect(rulesOf(check(say("11 304")))).toEqual([]);
    expect(rulesOf(check(say("16 956")))).toEqual([]);
    expect(rulesOf(check(say("12 000")))).toEqual(["fact-ikze-limit"]);
  });

  it("rejects a wrong flat IKZE withdrawal tax and a wrong capital gains tax", () => {
    const ikze = mutate(MODEL, "pobiera 10% zryczałtowanego podatku od całej kwoty", "pobiera zryczałtowany podatek od IKZE 12% od całej kwoty");
    expect(rulesOf(check(ikze))).toEqual(["fact-ikze-withdrawal-tax"]);
    const belka = mutate(MODEL, "Ten podatek na IKE nie istnieje", "Podatek Belki, czyli 20% od zysku, na IKE nie istnieje");
    expect(rulesOf(check(belka))).toEqual(["fact-capital-gains-tax"]);
  });

  it("takes the year from the sentence before current_as_of", () => {
    const text = mutate(MODEL, "W 2026 roku na IKE wpłacisz najwyżej 28 260 zł", "W 2025 roku limit IKE wynosił 26 019 zł, a w 2026 roku na IKE wpłacisz najwyżej 28 260 zł");
    expect(rulesOf(check(text))).toEqual([]);
  });

  it("does not mistake a contribution amount for the limit", () => {
    const text = mutate(MODEL, "Niewykorzystanej części", "Wpłacając 1 000 zł miesięcznie, nie wyczerpiesz limitu IKE[^limit]. Niewykorzystanej części");
    expect(rulesOf(check(text))).toEqual([]);
  });

  it("warns, not fails, about a year the engine does not know", () => {
    const text = mutate(MODEL, "W 2026 roku na IKE wpłacisz najwyżej 28 260 zł", "Limit IKE na 2031 rok to 40 000 zł, a dziś wpłacisz najwyżej 28 260 zł");
    expect(check(text).filter((finding) => finding.rule === "fact-ike-limit").map((finding) => finding.severity)).toEqual(["warning"]);
  });
});

describe("sources of numbers", () => {
  it("requires a footnote next to every significant number", () => {
    const text = mutate(MODEL, "czyli 2 355 zł miesięcznie[^limit].", "czyli 2 355 zł miesięcznie.");
    expect(rulesOf(check(text))).toEqual(["number-source"]);
  });

  it("asks no source for ages, years and legal references", () => {
    const text = mutate(MODEL, "Limit to trzykrotność", "Art. 13a ust. 1 i M.P. 2025 poz. 1202 mówią o roku 2026 i 60 latach. Limit to trzykrotność");
    expect(rulesOf(check(text))).toEqual([]);
  });

  it("rejects a footnote whose address is missing from sources", () => {
    const text = mutate(
      MODEL,
      "[^ustawa]: Ustawa o IKE i IKZE, tekst jednolity: https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20041161205",
      "[^ustawa]: Ustawa o IKE i IKZE: https://example.org/ustawa",
    );
    expect(rulesOf(check(text))).toEqual(["footnote-not-in-sources"]);
  });

  it("rejects a footnote with neither an address nor the calculation mark", () => {
    const text = mutate(MODEL, "[^wyliczenie]: Wyliczenie Plan Majątku:", "[^wyliczenie]: Nasze obliczenia:");
    expect(rulesOf(check(text))).toEqual(["footnote-source"]);
  });

  it("rejects a reference without a definition", () => {
    const text = mutate(MODEL, "czyli 2 355 zł miesięcznie[^limit].", "czyli 2 355 zł miesięcznie[^brak].");
    expect(rulesOf(check(text))).toEqual(["footnote-undefined"]);
  });
});

describe("structure and metadata", () => {
  it("fails when current_as_of is in the future and warns when it is over a year old", () => {
    const future = mutate(MODEL, "current_as_of: 2026-10-01", "current_as_of: 2026-12-01");
    expect(rulesOf(check(future))).toEqual(["as-of-future"]);
    expect(rulesOf(check(MODEL, { today: "2027-10-02" }), "warning")).toEqual(["stale"]);
  });

  it("refuses a slug that differs from the file name, through the parser", () => {
    expect(check(MODEL, { fileName: "other.md" })).toEqual([
      { rule: "file", severity: "error", message: "the file name other.md differs from the slug plus .md (model.md)" },
    ]);
  });

  it("fails on an internal link to a page that does not exist", () => {
    const text = mutate(MODEL, "(/kalkulator#w=40&d=0&e=0&s=2355&k=6000&r=5)", "(/blog/nie-ma-takiego)");
    expect(check(text).find((finding) => finding.rule === "internal-link-target")?.message).toBe("an internal link leads nowhere: /blog/nie-ma-takiego");
  });

  it("treats absolute links to the app's own origins as internal", () => {
    const text = mutate(MODEL, "(/kalkulator#w=40&d=0&e=0&s=2355&k=6000&r=5)", "(https://www.planmajatku.pl/kalkulator#w=40)");
    expect(check(text)).toEqual([]);
  });

  it("fails without a question section and without a number in the lead", () => {
    const noQuestion = MODEL.replaceAll(/^(## .*)\?$/gm, "$1");
    expect(rulesOf(check(noQuestion))).toEqual(["section-question"]);
    const noNumber = mutate(
      MODEL,
      "W 2026 roku na IKE wpłacisz najwyżej 28 260 zł[^limit]. Kto robi to przez 20 lat przy 5% realnego zwrotu rocznie, kończy z kwotą około 934 tys. zł w dzisiejszych pieniądzach, a podatek Belki od tego zysku wyniósłby ponad 70 tys. zł[^wyliczenie].",
      "IKE pozwala oszczędzać bez podatku Belki, jeśli wypłacisz pieniądze w odpowiednim wieku. Konto zakłada się w domu maklerskim, banku albo funduszu, a wpłaty można rozłożyć na cały rok. Wybór instytucji decyduje o kosztach i o tym, w co trafią pieniądze.",
    );
    expect(rulesOf(check(noNumber))).toEqual(["lead-number"]);
  });

  it("refuses a file without frontmatter", () => {
    expect(check("Sam tekst.")).toEqual([{ rule: "file", severity: "error", message: "no frontmatter: the file starts with a --- line, the metadata, then a --- line" }]);
  });

  it("points at file lines: the body starts after the frontmatter", () => {
    const findings = check(AI_TEXT, { fileName: "ai-sounding.md" });
    expect(findings.find((finding) => finding.rule === "crucial")).toEqual({
      rule: "crucial",
      severity: "error",
      message: '"kluczową": "crucial", the most common Polish tic of language models; name what depends on the thing',
      line: 15,
    });
  });
});

describe("chart and text through the chart plugin", () => {
  const withChart = mutate(MODEL, "| Po ilu latach |", '::wykres{scenariusz="w=40&s=2355&r=5" typ="majatek"}\n\n| Po ilu latach |');
  const settings = (table: readonly string[] | null) => createFireSettings({ plugins: [factsPlugin, createChartPlugin(() => table)] });

  it("passes when the neighbouring paragraph quotes numbers from the chart table", () => {
    expect(check(withChart, { settings: settings(["2 355 zł", "5%", "40"]) })).toEqual([]);
  });

  it("fails when the paragraph next to the chart quotes a number the chart does not show", () => {
    expect(check(withChart, { settings: settings(["2 355 zł"]) }).find((finding) => finding.rule === "chart-matches-text")).toMatchObject({
      severity: "error",
      message: "numbers next to the chart are not in its table: 5",
    });
  });

  it("fails with the reason when the chart cannot be computed", () => {
    expect(rulesOf(check(withChart, { settings: settings(null) }))).toEqual(["chart-matches-text"]);
  });
});

describe("the publish gate", () => {
  const gate = createQualityGate(createFireSettings(), createTestClock(new Date("2026-10-03T10:00:00Z")));
  const parse = (text: string, name: string) => {
    const parsed = parseArticleFile(text, name, { fields: FIELDS });
    if (!parsed.ok) throw new Error(parsed.errors.join("; "));
    return parsed.article;
  };

  it("lets the model article through", () => {
    expect(gate({ name: "model.md", text: MODEL }, parse(MODEL, "model.md"))).toEqual([]);
  });

  it("returns one line per error, with rule and line, for an AI-sounding text", () => {
    const errors = gate({ name: "ai-sounding.md", text: AI_TEXT }, parse(AI_TEXT, "ai-sounding.md"));
    expect(errors.length).toBeGreaterThan(10);
    expect(errors).toContain('[crucial] line 15: "kluczową": "crucial", the most common Polish tic of language models; name what depends on the thing');
  });

  it("leaves internal link targets to softure-blog check", () => {
    const text = mutate(MODEL, "(/kalkulator#w=40&d=0&e=0&s=2355&k=6000&r=5)", "(/blog/nie-ma-takiego)");
    expect(gate({ name: "model.md", text }, parse(text, "model.md"))).toEqual([]);
  });
});
