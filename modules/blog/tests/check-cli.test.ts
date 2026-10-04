// `softure-blog check` (FIRE `scripts/blog-check.mts`, `content.test.ts`): the gate over files without
// a database, its exit codes, `--external` and `--today`; and `publish` refusing a text the default
// gate rejects. Article fixtures are .txt files: as .md, the repository link check would read their
// site paths as file links.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBlogCli, type CliOutput } from "@softure-ai/blog/cli";
import type { FetchLike, QualityOptionsInput } from "@softure-ai/blog/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticleFile, createConfig, createTestBlog, type TestBlog } from "./support.js";

const QUALITY_FIXTURES = new URL("./quality/fixtures/", import.meta.url);
const SHORT_TEXTS: QualityOptionsInput = { limits: { words: { article: { min: 150 } } } };
const TERM = `---
id: expense-ratio
slug: expense-ratio
kind: term
forms: [expense ratio]
title: Expense ratio
description: The yearly fee of a fund as a share of its assets, taken from the fund rather than billed.
status: published
current_as_of: 2026-10-01
---

The expense ratio is the yearly fee of a fund, taken from its assets instead of billed.

A fund that charges it lowers the price of a share. Funds publish it in their factsheet, next to the holdings and the index the fund follows, so two funds that track the same market can be compared by it. See [what an index fund costs](/blog/index-funds).
`;

/** An app folder: a Next.js route, the model article, a glossary term and the AI-sounding draft. */
const app = mkdtempSync(join(tmpdir(), "blog-check-"));
mkdirSync(join(app, "app/calculator"), { recursive: true });
writeFileSync(join(app, "app/calculator/page.tsx"), "");
mkdirSync(join(app, "content/blog"), { recursive: true });
cpSync(new URL("index-funds.txt", QUALITY_FIXTURES), join(app, "content/blog/index-funds.md"));
writeFileSync(join(app, "content/blog/expense-ratio.md"), TERM);
mkdirSync(join(app, "drafts"));
cpSync(new URL("ai-sounding.txt", QUALITY_FIXTURES), join(app, "drafts/ai-sounding.md"));
afterAll(() => rmSync(app, { recursive: true, force: true }));

function createOutput(): { output: CliOutput; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, output: { log: (line) => lines.push(line), error: (line) => errors.push(line) } };
}

async function check(argv: readonly string[], quality: QualityOptionsInput | false = SHORT_TEXTS, fetch?: FetchLike) {
  const { output, lines, errors } = createOutput();
  const code = await runBlogCli({
    config: createConfig({ quality }),
    argv: ["check", ...argv],
    cwd: app,
    output,
    openDatabase: () => Promise.reject(new Error("check must not open the database")),
    ...(fetch === undefined ? {} : { fetch }),
  });
  return { code, lines, errors };
}

describe("softure-blog check", () => {
  it("checks the content folder, resolving links to routes, articles and terms", async () => {
    expect(await check(["--today", "2026-10-03"])).toEqual({
      code: 0,
      lines: ["content/blog/expense-ratio.md: OK", "content/blog/index-funds.md: OK", "check: 2 file(s), 0 error(s), 0 warning(s): green"],
      errors: [],
    });
  });

  it("prints every finding with file and line and exits 1 on an error", async () => {
    const result = await check(["drafts", "--today", "2026-10-03"]);
    expect(result.code).toBe(1);
    expect(result.lines).toContain('drafts/ai-sounding.md:12: error [crucial] "crucial": a favourite word of language models; name what depends on the thing');
    expect(result.lines.at(-1)).toMatch(/^check: 1 file\(s\), \d+ error\(s\), \d+ warning\(s\): red, do not publish$/);
  });

  it("checks freshness against --today, else today in the app's time zone", async () => {
    const result = await check(["content/blog/index-funds.md", "--today", "2027-10-05"]);
    expect(result).toMatchObject({ code: 0, lines: [expect.stringContaining("warning [stale]") as unknown, expect.stringMatching(/green$/) as unknown] });
    expect((await check(["--today", "2026-13-01"])).code).toBe(2);
  });

  it("requests external links only with --external", async () => {
    const requested: string[] = [];
    const fetch: FetchLike = (url) => {
      requested.push(url);
      return Promise.resolve({ status: 404 });
    };
    expect((await check(["content/blog/index-funds.md", "--today", "2026-10-03"], SHORT_TEXTS, fetch)).code).toBe(0);
    expect(requested).toEqual([]);
    const result = await check(["content/blog/index-funds.md", "--external", "--today", "2026-10-03"], SHORT_TEXTS, fetch);
    expect(result.code).toBe(1);
    expect(result.lines[0]).toBe("content/blog/index-funds.md:38: error [external-link-dead] an external link does not answer 2xx (HTTP 404): https://www.sec.gov/investor/alerts/ib_mutualfundfees.pdf");
  });

  it("refuses to run with the gate off and names an unreadable path", async () => {
    expect(await check([], false)).toMatchObject({ code: 1, errors: ["softure-blog check: the quality gate is off (blog({ quality: false })); nothing to check"] });
    expect(await check(["missing"])).toMatchObject({ code: 1, errors: [`softure-blog check: cannot read ${join(app, "missing")}`] });
  });

  it("refuses unknown options with exit code 2", async () => {
    expect((await check(["--commit"])).code).toBe(2);
  });
});

describe("softure-blog publish with the default gate", () => {
  let test: TestBlog;
  beforeEach(async () => {
    test = await createTestBlog({ quality: SHORT_TEXTS });
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function publish(dir: string) {
    const { output, lines, errors } = createOutput();
    const code = await runBlogCli({
      config: test.config,
      argv: ["publish", dir, "--commit"],
      output,
      clock: test.clock,
      openDatabase: () => Promise.resolve({ kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve() }),
    });
    return { code, lines, errors };
  }

  it("refuses a published text the gate rejects, and lets a draft through", async () => {
    const dir = mkdtempSync(join(tmpdir(), "blog-gate-"));
    try {
      const body = readFileSync(new URL("ai-sounding.txt", QUALITY_FIXTURES), "utf8").split("---\n").slice(2).join("---\n");
      const file = buildArticleFile({ id: "ai-sounding", slug: "ai-sounding", summary: undefined, faq: undefined }, body);
      writeFileSync(join(dir, file.name), file.text);
      const refused = await publish(dir);
      expect(refused.code).toBe(1);
      expect(refused.errors).toContain('error ai-sounding.md: quality gate: [crucial] line 16: "crucial": a favourite word of language models; name what depends on the thing');
      expect(refused.errors.at(-1)).toBe("refused: nothing written; fix the problems above");

      const draft = buildArticleFile({ id: "ai-sounding", slug: "ai-sounding", status: "draft" }, body);
      writeFileSync(join(dir, draft.name), draft.text);
      expect((await publish(dir)).code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
