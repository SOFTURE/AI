// Issue #318: the generic pieces an adopting data-driven blog kept as its own plugins and helpers. The
// block-numbers rule, fact rules and `softure-blog refresh`, the static-page read guard, `readArticleDir`,
// the combined proxy piece and featured articles.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBlogCli, type CliOutput } from "@softure-ai/blog/cli";
import * as cli from "@softure-ai/blog/cli";
import { createBlogProxy } from "@softure-ai/blog/proxy";
import {
  checkArticleText,
  factRule,
  findTextsToRefresh,
  listQualityRules,
  qualityOptionsSchema,
  readArticleDir,
  readForStaticPage,
  resolveQualitySettings,
  selectFeaturedArticles,
  type BlockPlugin,
  type QualityOptionsInput,
} from "@softure-ai/blog/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createPublishedBlog } from "./next/support.js";
import { buildStoredArticle, createConfig, type TestBlog } from "./support.js";

const MODEL = readFileSync(new URL("./quality/fixtures/index-funds.txt", import.meta.url), "utf8");
const SHORT_TEXTS: QualityOptionsInput = { limits: { words: { article: { min: 150 } } } };

function settingsOf(options: QualityOptionsInput) {
  return resolveQualitySettings(qualityOptionsSchema.parse({ ...SHORT_TEXTS, ...options }), { appOrigin: "https://example.com", timezone: "UTC" });
}

function check(options: QualityOptionsInput, text = MODEL) {
  return checkArticleText({ text, fileName: "index-funds.md", settings: settingsOf(options), today: "2026-10-03" }).findings;
}

function chartWith(numbers: BlockPlugin["numbers"]): BlockPlugin {
  return { type: "chart", render: () => ({ kind: "html", html: "" }), numbers };
}

const CHART = "```chart wealth\nwealth over 20 years\n```";
/** The chart right after the paragraph of line 28 ($500, $205,000, 0.2%, $200,400, 1%, $184,000). */
const CHART_AFTER = MODEL.replace("and a 1% fee about $184,000.\n", `and a 1% fee about $184,000.\n\n${CHART}\n`);
/** The chart right before it: under the heading, so the paragraph (now line 32) follows the block. */
const CHART_BEFORE = MODEL.replace("## How much does the fee take over 20 years?\n", `## How much does the fee take over 20 years?\n\n${CHART}\n`);
const ALL_NUMBERS = [500, 205_000, 0.2, 200_400, 1, "184,000"];

describe("block-numbers (#318, 1)", () => {
  it("passes when every significant number around the block is one of its numbers", () => {
    expect(check({ blocks: [chartWith(() => ALL_NUMBERS)] }, CHART_AFTER)).toEqual([]);
    expect(check({ blocks: [chartWith(() => ALL_NUMBERS)] }, CHART_BEFORE)).toEqual([]);
  });

  it("reports a number of the paragraph before the block that the block lacks", () => {
    expect(check({ blocks: [chartWith(() => ALL_NUMBERS.slice(0, 5))] }, CHART_AFTER)).toEqual([
      { rule: "block-numbers", severity: "error", message: "the paragraph before the chart block quotes 184,000, which is not among the block's numbers", line: 28 },
    ]);
  });

  it("reports a number of the paragraph after the block that the block lacks", () => {
    expect(check({ blocks: [chartWith(() => ALL_NUMBERS.filter((value) => value !== 205_000))] }, CHART_BEFORE)).toEqual([
      { rule: "block-numbers", severity: "error", message: "the paragraph after the chart block quotes 205,000, which is not among the block's numbers", line: 32 },
    ]);
  });

  it("hands numbers() the block's content and article, and reports a throw instead of crashing", () => {
    const seen: string[] = [];
    check({ blocks: [chartWith((block) => { seen.push(`${block.info}|${block.content.trim()}|${block.article.currentAsOf ?? ""}`); return ALL_NUMBERS; })] }, CHART_AFTER);
    expect(seen).toEqual(["wealth|wealth over 20 years|2026-10-01"]);
    expect(check({ blocks: [chartWith(() => { throw new Error("no table"); })] }, CHART_AFTER)).toEqual([
      { rule: "block-numbers", severity: "error", message: "numbers() of the chart block failed: no table", line: 30 },
    ]);
  });

  it("is in the catalog only when a block plugin has numbers()", () => {
    const ids = (options: QualityOptionsInput) => listQualityRules(settingsOf(options)).map((rule) => rule.id);
    expect(ids({ blocks: [{ type: "chart", render: () => ({ kind: "html", html: "" }) }] })).not.toContain("block-numbers");
    expect(ids({ blocks: [chartWith(() => [])] })).toContain("block-numbers");
  });
});

/** Line 22: "Most broad index funds charge between 0.03% and 0.2% a year". */
function feeFloor(allowed: (year: number) => readonly number[] | undefined, expires: "yearly" | "quarterly" | "never" = "never") {
  return factRule({ id: "index-fee-floor", description: "the lowest fee of a broad index fund", patterns: [/broad index funds/gi], allowedValues: allowed, unit: "bps", expires });
}

describe("fact rules (#318, 2)", () => {
  it("compares the first number of a matching sentence with the values of its year, in the rule's unit", () => {
    const years: number[] = [];
    expect(check({ facts: [feeFloor((year) => { years.push(year); return [3]; })] })).toEqual([]);
    expect(years).toEqual([2026]);
    expect(check({ facts: [feeFloor(() => [5])] })).toEqual([
      { rule: "index-fee-floor", severity: "error", message: "the lowest fee of a broad index fund: 0.03 does not match the 2026 value (5 bps)", line: 22 },
    ]);
  });

  it("takes the year from the sentence before current_as_of, and leaves a year without values unchecked", () => {
    const text = MODEL.replace("Most broad index funds charge", "In 2024 most broad index funds charged");
    const years: number[] = [];
    expect(check({ facts: [feeFloor((year) => { years.push(year); return year === 2026 ? [3] : undefined; })] }, text)).toEqual([]);
    expect(years).toEqual([2024]);
  });

  it("lists the rules in the catalog with their severity", () => {
    const rules = listQualityRules(settingsOf({ facts: [feeFloor(() => [3])], severity: { "index-fee-floor": "warning" } }));
    expect(rules.find((rule) => rule.id === "index-fee-floor")).toEqual({ group: "facts", id: "index-fee-floor", severity: "warning", description: "the lowest fee of a broad index fund" });
  });

  it("refuses a rule without patterns", () => {
    expect(qualityOptionsSchema.safeParse({ facts: [{ ...feeFloor(() => [3]), patterns: [] }] }).success).toBe(false);
  });

  it("lists the published texts to refresh: stale ones and those quoting a value that changed since current_as_of", () => {
    const files = [
      { name: "index-funds.md", text: MODEL },
      { name: "old.md", text: MODEL.replace("current_as_of: 2026-10-01", "current_as_of: 2025-09-01").replace(/^id: index-funds$/m, "id: old").replace(/^slug: index-funds$/m, "slug: old").replace("broad index funds", "index funds") },
      { name: "draft.md", text: MODEL.replace("status: published", "status: draft").replace(/^id: index-funds$/m, "id: draft").replace(/^slug: index-funds$/m, "slug: draft") },
    ];
    const settings = settingsOf({ facts: [feeFloor(() => [3], "quarterly")] });
    expect(findTextsToRefresh(files, settings, "2026-10-03")).toEqual([
      { file: "old.md", slug: "old", currentAsOf: "2025-09-01", reasons: [{ kind: "stale", days: 397 }] },
    ]);
    expect(findTextsToRefresh(files, settings, "2027-01-02")).toEqual([
      { file: "index-funds.md", slug: "index-funds", currentAsOf: "2026-10-01", reasons: [{ kind: "fact", rule: "index-fee-floor", changedOn: "2027-01-01" }] },
      { file: "old.md", slug: "old", currentAsOf: "2025-09-01", reasons: [{ kind: "stale", days: 488 }] },
    ]);
  });
});

const app = mkdtempSync(join(tmpdir(), "blog-318-"));
/** `MODEL` under another slug. */
const renameModel = (slug: string, text = MODEL) => text.replace(/^id: index-funds$/m, `id: ${slug}`).replace(/^slug: index-funds$/m, `slug: ${slug}`);
const B_TEXT = renameModel("b");
writeFileSync(join(app, "b.md"), B_TEXT);
writeFileSync(join(app, "a.md"), renameModel("a", MODEL.replace("current_as_of: 2026-10-01", "current_as_of: 2025-09-01").replace("broad index funds", "index funds")));
writeFileSync(join(app, "README.md"), "# Notes");
writeFileSync(join(app, "notes.txt"), "not an article");
afterAll(() => rmSync(app, { recursive: true, force: true }));

function createOutput(): { output: CliOutput; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, output: { log: (line) => lines.push(line), error: (line) => errors.push(line) } };
}

describe("softure-blog refresh (#318, 2)", () => {
  async function refresh(argv: readonly string[], quality: QualityOptionsInput | false = { ...SHORT_TEXTS, facts: [feeFloor(() => [3], "yearly")] }) {
    const { output, lines, errors } = createOutput();
    const code = await runBlogCli({
      config: createConfig({ quality }),
      argv: ["refresh", ...argv],
      cwd: app,
      output,
      openDatabase: () => Promise.reject(new Error("refresh must not open the database")),
    });
    return { code, lines, errors };
  }

  it("prints the texts to refresh with their reasons and exits 0", async () => {
    expect(await refresh([".", "--today", "2027-01-02"])).toEqual({
      code: 0,
      lines: [
        "a.md: current_as_of 2025-09-01 is older than 365 days (488)",
        "b.md: index-fee-floor changed on 2027-01-01, after current_as_of 2026-10-01",
        "refresh: 2 of 2 published text(s) to refresh",
      ],
      errors: [],
    });
    expect((await refresh([".", "--today", "2026-10-03"])).lines).toEqual(["a.md: current_as_of 2025-09-01 is older than 365 days (397)", "refresh: 1 of 2 published text(s) to refresh"]);
  });

  it("fails on a path it cannot read and without a gate", async () => {
    expect(await refresh(["missing"])).toMatchObject({ code: 1, errors: [`softure-blog refresh: cannot read ${join(app, "missing")}`] });
    expect(await refresh(["."], false)).toMatchObject({ code: 1, errors: ["softure-blog refresh: the quality gate is off (blog({ quality: false })); nothing to refresh"] });
  });
});

describe("readArticleDir (#318, 4)", () => {
  it("reads every .md file but README.md, sorted by name", async () => {
    const result = await readArticleDir(app);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files.map((file) => [file.name, file.path])).toEqual([
      ["a.md", join(app, "a.md")],
      ["b.md", join(app, "b.md")],
    ]);
    expect(result.files[1]?.text).toBe(B_TEXT);
  });

  it("returns why a folder cannot be read, and is on /cli too", async () => {
    expect(await readArticleDir(join(app, "missing"))).toEqual({ ok: false, error: `cannot read ${join(app, "missing")}` });
    expect(cli.readArticleDir).toBe(readArticleDir);
  });
});

describe("readForStaticPage (#318, 3)", () => {
  it("reads nothing during next build", async () => {
    let calls = 0;
    expect(await readForStaticPage(() => { calls += 1; return Promise.resolve([1]); }, { phase: "phase-production-build" })).toEqual([]);
    expect(calls).toBe(0);
  });

  it("answers the rows, or nothing and a log line when the read fails", async () => {
    const logged: string[] = [];
    expect(await readForStaticPage(() => Promise.resolve([1, 2]), { phase: undefined })).toEqual([1, 2]);
    expect(await readForStaticPage(() => Promise.reject(new Error("connection refused")), { phase: undefined, onError: (message) => logged.push(message) })).toEqual([]);
    expect(logged).toEqual(["@softure-ai/blog: reading published articles for a static page failed: connection refused"]);
  });
});

describe("selectFeaturedArticles (#318, 6)", () => {
  const newest = buildStoredArticle({ id: "newest", slug: "newest" });
  const pillar = buildStoredArticle({ id: "pillar", slug: "pillar", isPillar: true });
  const older = buildStoredArticle({ id: "older", slug: "older" });

  it("puts pillars first, keeps the given order within each part, and stops at the limit", () => {
    expect(selectFeaturedArticles([newest, pillar, older], { limit: 2 }).map((article) => article.slug)).toEqual(["pillar", "newest"]);
    expect(selectFeaturedArticles([newest, pillar, older], { limit: 10 }).map((article) => article.slug)).toEqual(["pillar", "newest", "older"]);
    expect(selectFeaturedArticles([newest], { limit: 0 })).toEqual([]);
  });

  it("refuses a limit that is not a whole number from 0 up", () => {
    expect(() => selectFeaturedArticles([], { limit: -1 })).toThrow(RangeError);
    expect(() => selectFeaturedArticles([], { limit: 1.5 })).toThrow(RangeError);
  });
});

describe("createBlogProxy (#318, 5)", () => {
  let test: TestBlog | undefined;
  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("answers Markdown first, then the redirects, then nothing", async () => {
    test = await createPublishedBlog();
    const ctx = test.ctx;
    const proxy = createBlogProxy(test.config, { getContext: () => Promise.resolve(ctx) });
    const markdown = await proxy(new Request("https://app.example.com/blog/index-funds", { headers: { accept: "text/markdown" } }));
    expect(markdown?.status).toBe(200);
    expect(markdown?.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const moved = await proxy(new Request("https://app.example.com/blog/renamed-before", { headers: { accept: "text/markdown" } }));
    expect(moved?.status).toBe(301);
    expect(moved?.headers.get("location")).toBe("https://app.example.com/blog/renamed-after");
    expect(await proxy(new Request("https://app.example.com/blog/index-funds"))).toBeNull();
    expect(await proxy(new Request("https://app.example.com/pricing"))).toBeNull();
  });
});
