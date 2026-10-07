// The writing skill (FIRE `.claude/skills/blog-pisz/`, `skill-sync.test.ts`): the template renderer,
// the skill rendered for an app's config, and the sync between the shipped templates and the gate's
// rule catalog, in both directions.
import { wordPattern } from "@softure-ai/blog";
import { fillRulesTables, findTemplateRuleIds, listTemplateFiles, readSkillTemplate, renderBlogSkill, renderSkillTemplate, SKILL_MARKER, type SkillFile } from "@softure-ai/blog/cli";
import { getQualitySettings, listQualityRules, type BlockPlugin, type QualityCatalogRule, type QualityOptionsInput, type QualityPlugin } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig } from "./support.js";

const TICKER_PLUGIN: QualityPlugin = {
  name: "tickers",
  rules: [{ id: "ticker-format", severity: "error", description: "tickers are written in capitals" }],
  check: () => [],
};
const CHART_BLOCK: BlockPlugin = { type: "chart", requires: ["scenario"], render: () => ({ kind: "html", html: "" }) };

/** Every switch on: the widest catalog a ruleset can give. */
function createFullQuality(language: "en" | "pl"): QualityOptionsInput {
  return {
    language,
    ymyl: { ownCalculationMark: "our calculation" },
    voice: { forbidFirstPersonSingular: true, phrases: [{ id: "finance-cliche", pattern: wordPattern("in the world of finance"), message: "say what happens instead" }] },
    plugins: [TICKER_PLUGIN],
    blocks: [CHART_BLOCK, { ...CHART_BLOCK, syntax: "directive" }],
  };
}

function listCatalog(quality: QualityOptionsInput, extra: Parameters<typeof createConfig>[0] = {}): QualityCatalogRule[] {
  const settings = getQualitySettings(createConfig({ ...extra, quality }));
  if (settings === null) throw new Error("the gate is on in these tests");
  return listQualityRules(settings);
}

function getFile(files: readonly SkillFile[], path: string): string {
  const file = files.find((entry) => entry.path === path);
  if (file === undefined) throw new Error(`the skill has no ${path}`);
  return file.text;
}

/** The rule ids the rendered rules file lists in its tables, in order. */
function findListedRuleIds(rules: string): string[] {
  return [...rules.matchAll(/^\| `([a-z0-9-]+)` \| (\*\*error\*\*|warning) \|/gm)].map((match) => match[1] ?? "");
}

describe("renderSkillTemplate", () => {
  it("fills values and keeps a section whose flag is set", () => {
    expect(renderSkillTemplate("Run {{command}}.{{#ymyl}} Sources.{{/ymyl}}", { command: "npx softure-blog", ymyl: true })).toBe("Run npx softure-blog. Sources.");
  });

  it("drops a section whose flag is unset and keeps its inverted section", () => {
    expect(renderSkillTemplate("a{{#ymyl}}b{{/ymyl}}{{^ymyl}}c{{/ymyl}}", { ymyl: false })).toBe("ac");
  });

  it("reads an empty string as unset and a non-empty one as set", () => {
    expect(renderSkillTemplate("{{#mark}}[{{mark}}]{{/mark}}{{^empty}}none{{/empty}}", { mark: "calc", empty: "" })).toBe("[calc]none");
  });

  it("takes a section tag alone on its line together with the line", () => {
    expect(renderSkillTemplate("one\n{{#on}}\ntwo\n{{/on}}\nthree\n", { on: true })).toBe("one\ntwo\nthree\n");
    expect(renderSkillTemplate("one\n{{#on}}\ntwo\n{{/on}}\nthree\n", { on: false })).toBe("one\nthree\n");
  });

  it("does not need values inside a dropped section", () => {
    expect(renderSkillTemplate("{{#off}}{{missing}}{{/off}}ok", { off: false })).toBe("ok");
  });

  it("refuses a name without a value, a flag used as a value and a section that does not close", () => {
    expect(() => renderSkillTemplate("{{missing}}", {})).toThrow("no value for {{missing}}");
    expect(() => renderSkillTemplate("{{on}}", { on: true })).toThrow("{{on}} is a flag");
    expect(() => renderSkillTemplate("{{#on}}text", { on: true })).toThrow("{{#on}} is not closed");
    expect(() => renderSkillTemplate("{{#on}}text{{/off}}", { on: true, off: false })).toThrow("{{/off}} closes {{#on}}");
  });
});

describe("fillRulesTables", () => {
  const header = "## Style\n\n| Rule | Severity | What the gate looks for | What to write instead |\n| --- | --- | --- | --- |";
  const template = `${header}\n| \`crucial\` | | | Name it. |\n| \`emoji\` | | | Remove it. |\n\n## The app's own rules\n\n`;
  const rule = (id: string, severity: "error" | "warning", description: string): QualityCatalogRule => ({ group: "style", id, severity, description });

  it("fills the severity and description, drops a rule the gate lacks and lists the app's rules", () => {
    expect(fillRulesTables(template, [rule("crucial", "warning", "a favourite word"), rule("brand-tone", "error", "no slang | jargon")])).toBe(
      `${header}\n| \`crucial\` | warning | a favourite word | Name it. |\n\n## The app's own rules\n\nRules of the app's voice and its plugins; the description is the app's own.\n\n| Rule | Severity | What the gate looks for |\n| --- | --- | --- |\n| \`brand-tone\` | **error** | no slang \\| jargon |`,
    );
  });

  it("drops a table left without rows together with its heading", () => {
    expect(fillRulesTables(template, [])).toBe("## The app's own rules\n\nNone: the gate enforces only the rules above.");
  });
});

describe("the shipped skill and the gate's catalog", () => {
  const rulesTemplate = readSkillTemplate("references/rules.md");
  const templateIds = findTemplateRuleIds(rulesTemplate);
  const appDefinedIds = new Set(["finance-cliche", "ticker-format"]);
  const builtInIds = new Set([...listCatalog(createFullQuality("en")), ...listCatalog(createFullQuality("pl"))].map((rule) => rule.id).filter((id) => !appDefinedIds.has(id)));

  it("ships SKILL.md and its four references", () => {
    expect(listTemplateFiles()).toEqual(["SKILL.md", "references/reviewer.md", "references/rules.md", "references/structure.md", "references/template.md"]);
  });

  it("names every built-in rule of the gate once", () => {
    expect(templateIds.length).toBe(new Set(templateIds).size);
    expect([...builtInIds].filter((id) => !templateIds.includes(id))).toEqual([]);
  });

  it("names no rule the gate lacks", () => {
    expect(templateIds.filter((id) => !builtInIds.has(id))).toEqual([]);
  });

  it("mentions in prose only rules the gate has", () => {
    const mentioned = listTemplateFiles().flatMap((path) => [...readSkillTemplate(path).matchAll(/\brule `([a-z0-9-]+)`/g)].map((match) => match[1] ?? ""));
    expect(mentioned.length).toBeGreaterThan(0);
    expect(mentioned.filter((id) => !builtInIds.has(id))).toEqual([]);
  });
});

describe("renderBlogSkill", () => {
  it("fills the skill for the defaults: English, no YMYL, the default command and folder", () => {
    const files = renderBlogSkill(createConfig());
    const skill = getFile(files, "SKILL.md");
    expect(skill).toContain(SKILL_MARKER);
    expect(skill).toContain("Write in **English**.");
    expect(skill).toContain("`npx softure-blog check content/blog/<slug>.md`");
    expect(skill).not.toContain("never \"I\"");
    expect(getFile(files, "references/structure.md")).toContain("up to 90 words");
    for (const file of files) expect(file.text, file.path).not.toMatch(/\{\{|\}\}/);
  });

  it("lists exactly the catalog's rules with their effective severity", () => {
    const quality: QualityOptionsInput = { severity: { exclamation: "error", "lead-number": "off" } };
    const catalog = listCatalog(quality);
    const rules = getFile(renderBlogSkill(createConfig({ quality })), "references/rules.md");
    expect(findListedRuleIds(rules).sort()).toEqual(catalog.map((rule) => rule.id).sort());
    expect(rules).toContain("| `exclamation` | **error** |");
    expect(rules).not.toContain("`lead-number`");
    expect(rules).not.toContain("## YMYL");
    expect(rules).not.toContain("## Voice");
    expect(rules).toContain("None: the gate enforces only the rules above.");
  });

  it("fills a FIRE-like Polish config: YMYL with the calculation mark, the editors' voice, phrases, plugins and fields", () => {
    const quality = { ...createFullQuality("pl"), limits: { leadWords: { article: 80 } } };
    const config = createConfig({ contentDir: "content/blog/", reservedSlugs: ["glossary"], fields: z.object({ scenario: z.string().optional() }), quality });
    const files = renderBlogSkill(config, { command: "npm run blog --" });
    const skill = getFile(files, "SKILL.md");
    const rules = getFile(files, "references/rules.md");
    expect(skill).toContain("Write in **Polish**.");
    expect(skill).toContain("never \"I\"");
    expect(skill).toContain("`npm run blog -- check content/blog/<slug>.md`");
    expect(findListedRuleIds(rules).sort()).toEqual(listCatalog(quality, { fields: z.object({ scenario: z.string().optional() }) }).map((rule) => rule.id).sort());
    expect(rules).toContain("| `finance-cliche` | **error** | say what happens instead |");
    expect(rules).toContain("| `ticker-format` | **error** | tickers are written in capitals |");
    expect(rules).toContain("or the phrase \"our calculation\" with its inputs");
    expect(getFile(files, "references/structure.md")).toContain("`[^calc]: our calculation: <inputs>, as of YYYY-MM-DD.`");
    expect(getFile(files, "references/structure.md")).toContain("up to 80 words");
    expect(getFile(files, "references/template.md")).toContain("The app adds its own keys: `scenario`.");
    expect(getFile(files, "references/template.md")).toContain("never usable for a text: `glossary`.");
    for (const file of files) expect(file.text, file.path).not.toMatch(/\{\{|\}\}/);
  });

  it("renders the same text twice, so a reinstall changes nothing", () => {
    expect(renderBlogSkill(createConfig())).toEqual(renderBlogSkill(createConfig()));
  });

  it("refuses an app whose gate is off", () => {
    expect(() => renderBlogSkill(createConfig({ quality: false }))).toThrow("the quality gate is off");
  });
});

/** FIRE_TRACKER's own passages of `blog-pisz`, as the app would pass them. */
const FIRE_SECTIONS = [
  { title: "Engine numbers", body: "Every number of an example comes from the app's engine (`npm run engine -- <inputs>`), never from memory." },
  { title: "Calculator scenario", body: "Set `scenario` in the frontmatter to the calculator's preset that matches the example.\n\n### When none matches\n\nLeave it out." },
  { title: "Chart block", body: "Show the example with one `::chart{scenario=\"{{scenario}}\"}` block after the lead." },
];

describe("the app's own sections", () => {
  it("leave the skill byte for byte as before when the app has none", () => {
    const files = renderBlogSkill(createConfig());
    expect(files.map((file) => file.path)).toEqual(listTemplateFiles());
    expect(getFile(files, "SKILL.md")).not.toContain("references/app.md");
    expect(renderBlogSkill(createConfig({ skill: { sections: [] } }))).toEqual(files);
  });

  it("go into references/app.md, verbatim, and SKILL.md names them", () => {
    const files = renderBlogSkill(createConfig({ skill: { sections: FIRE_SECTIONS } }));
    expect(files.map((file) => file.path)).toEqual([...listTemplateFiles(), "references/app.md"].sort());
    expect(getFile(files, "references/app.md")).toBe(
      [
        "# The app's own sections",
        "",
        "Written by the app in its blog config (`blog({ skill: { sections } })`). They add to this skill where they name",
        "the app's own data, blocks and fields; they never switch off a rule of the gate.",
        "",
        "## Engine numbers",
        "",
        FIRE_SECTIONS[0]?.body,
        "",
        "## Calculator scenario",
        "",
        FIRE_SECTIONS[1]?.body,
        "",
        "## Chart block",
        "",
        FIRE_SECTIONS[2]?.body,
        "",
      ].join("\n"),
    );
    const skill = getFile(files, "SKILL.md");
    expect(skill).toContain("## The app's own sections\n\n`references/app.md` adds this app's own procedure: Engine numbers, Calculator scenario, Chart block.");
    expect(skill).toContain("with a test.\n\n## The app's own sections");
    expect(skill).toContain("never switches off a rule of the gate.\n\n## Refreshing a text");
  });

  it("render the same text twice, so a reinstall changes nothing", () => {
    const config = createConfig({ skill: { sections: FIRE_SECTIONS } });
    expect(renderBlogSkill(config)).toEqual(renderBlogSkill(config));
  });
});
