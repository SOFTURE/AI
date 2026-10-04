// `softure-blog publish` over a database connection, and the bin that loads the app's config.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runBlogCli, runBlogCommand, type CliOutput, type RunBlogCliOptions } from "@softure-ai/blog/cli";
import { findArticleBySlug } from "@softure-ai/blog/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticleText, createTestBlog, type TestBlog } from "./support.js";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));
const APP_DIR = fileURLToPath(new URL("./fixtures/app/", import.meta.url));

function createOutput(): { output: CliOutput; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, output: { log: (line) => lines.push(line), error: (line) => errors.push(line) } };
}

describe("softure-blog publish", () => {
  let test: TestBlog;
  let opened: number;
  let closed: number;

  beforeEach(async () => {
    test = await createTestBlog({ contentDir: "content" });
    opened = 0;
    closed = 0;
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function run(argv: string[], options: Partial<RunBlogCliOptions> = {}) {
    const { output, lines, errors } = createOutput();
    const code = await runBlogCli({
      config: test.config,
      argv,
      cwd: FIXTURES_DIR,
      output,
      clock: test.clock,
      // The test database stays open across runs; the command closes only its own handle.
      openDatabase: () => {
        opened += 1;
        return Promise.resolve({ kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve(void (closed += 1)) });
      },
      ...options,
    });
    return { code, lines, errors };
  }

  it("dry-runs the configured folder without its README and writes nothing", async () => {
    expect(await run(["publish"])).toEqual({
      code: 0,
      lines: [
        "added index-funds none -> published/index-funds",
        "added tax-wrapper none -> draft/tax-wrapper",
        "summary: added 2, changed 0, unchanged 0",
        "dry run: nothing written; pass --commit to write",
      ],
      errors: [],
    });
    expect(await findArticleBySlug(test.ctx, "index-funds")).toBeNull();
    expect([opened, closed]).toEqual([1, 1]);
  });

  it("writes with --commit; the same files again are unchanged", async () => {
    expect((await run(["publish", "content", "--commit"])).lines.slice(-1)).toEqual(["written"]);
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ status: "published", isPillar: true });
    expect((await run(["publish", "content/index-funds.md", "--commit"])).lines).toEqual([
      "unchanged index-funds published/index-funds -> published/index-funds",
      "summary: added 0, changed 0, unchanged 1",
      "written",
    ]);
  });

  it("prints a slug change and a withdrawal with its warning", async () => {
    await run(["publish", "--commit"]);
    const dir = mkdtempSync(join(tmpdir(), "softure-blog-"));
    try {
      writeFileSync(join(dir, "funds.md"), buildArticleText({ id: "index-funds", slug: "funds", cluster: "investing-basics", pillar: true }));
      expect((await run(["publish", join(dir, "funds.md"), "--commit"])).lines.slice(0, 2)).toEqual([
        "changed index-funds published/index-funds -> published/funds",
        "moved index-funds index-funds -> funds",
      ]);
      expect(await run(["publish", join(dir, "funds.md"), "--withdraw", "--commit"])).toMatchObject({
        code: 0,
        lines: ["changed index-funds published/funds -> withdrawn/funds", "summary: added 0, changed 1, unchanged 0", "written"],
        errors: ["warning funds.md: the file says status: published; set it to withdrawn, or the next full publish brings the text back"],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a bad file with every problem and exit code 1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "softure-blog-"));
    try {
      writeFileSync(join(dir, "draft.md"), buildArticleText({ title: "" }));
      expect(await run(["publish", dir, "--commit"])).toEqual({
        code: 1,
        lines: [],
        errors: [
          "error draft.md: title: Too small: expected string to have >=1 characters",
          "refused: nothing written; fix the problems above",
        ],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes the app's gate to the run", async () => {
    const result = await run(["publish", "--commit"], { gate: () => ["too short"] });
    expect(result).toMatchObject({ code: 1, errors: ["error index-funds.md: quality gate: too short", "refused: nothing written; fix the problems above"] });
  });

  it("reports a path it cannot read, and --withdraw over a folder, before opening the database", async () => {
    expect(await run(["publish", "missing"])).toMatchObject({ code: 1, errors: [`softure-blog publish: cannot read ${FIXTURES_DIR}missing`] });
    expect(await run(["publish", "content", "--withdraw"])).toMatchObject({
      code: 1,
      errors: ["softure-blog publish: --withdraw takes exactly one article file, not a folder"],
    });
    expect(opened).toBe(0);
  });

  it("refuses usage errors with exit code 2", async () => {
    for (const argv of [[], ["push"], ["publish", "--force"], ["publish", "a.md", "b.md", "--withdraw"], ["publish", "--withdraw"]]) {
      const result = await run(argv);
      expect(result.code, argv.join(" ")).toBe(2);
    }
    expect((await run(["publish", "--force"])).errors[0]).toMatch(/^softure-blog: Unknown option '--force'/);
    expect(opened).toBe(0);
  });

  it("shows the help", async () => {
    const result = await run(["publish", "--help"]);
    expect(result.code).toBe(0);
    expect(result.lines[0]).toMatch(/^Usage:\n {2}softure-blog publish/);
  });

  it("needs the blog in the config and a database", async () => {
    const withoutBlog = { ...test.config, modules: [] };
    expect(await run(["publish"], { config: withoutBlog })).toMatchObject({
      code: 1,
      errors: ["softure-blog publish: @softure-ai/blog: the module is not enabled; add blog() to modules in softure.config.ts"],
    });
    expect(await run(["publish"], { config: { ...test.config, database: null } })).toMatchObject({
      code: 1,
      errors: ["softure-blog publish: the config has no database; set database.url in softure.config"],
    });
  });

  it("reports a database error without the URL", async () => {
    const result = await run(["publish"], { openDatabase: () => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:5432")) });
    expect(result).toMatchObject({ code: 1, errors: ["softure-blog publish: connect ECONNREFUSED 127.0.0.1:5432"] });
  });
});

describe("the softure-blog bin", () => {
  async function runBin(argv: string[], cwd = APP_DIR) {
    const { output, lines, errors } = createOutput();
    const code = await runBlogCommand({ argv, cwd, output });
    return { code, lines, errors };
  }

  it("loads softure.config.mjs from the working directory", async () => {
    const result = await runBin(["publish"]);
    expect(result).toMatchObject({ code: 1 });
    // The in-memory database of the fixture has no tables: the config loaded and the command ran.
    expect(result.errors[0]).toMatch(/^softure-blog publish: relation "blog\.articles" does not exist/);
  });

  it("refuses usage errors before it looks for a config", async () => {
    expect(await runBin(["publish", "--force"], FIXTURES_DIR)).toMatchObject({ code: 2 });
    expect(await runBin(["publish", "--config"])).toMatchObject({ code: 2, errors: ["softure-blog: --config needs a file path", expect.stringMatching(/^Usage:/) as unknown] });
    expect((await runBin(["--help"], FIXTURES_DIR)).code).toBe(0);
  });

  it("reports a missing config", async () => {
    expect(await runBin(["publish"], FIXTURES_DIR)).toMatchObject({
      code: 1,
      errors: [`softure-blog: no config found; looked for softure.config.ts, softure.config.mts, softure.config.js, softure.config.mjs in ${FIXTURES_DIR}; pass --config <file>`],
    });
    expect(await runBin(["publish", "--config", "nowhere.mjs"], FIXTURES_DIR)).toMatchObject({ code: 1, errors: [`softure-blog: config file ${FIXTURES_DIR}nowhere.mjs does not exist`] });
  });
});
