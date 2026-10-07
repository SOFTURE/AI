// `softure-blog publish` over a database connection, and the bin that loads the app's config.
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runBlogCli, runBlogCommand, type CliOutput, type RunBlogCliOptions } from "@softure-ai/blog/cli";
import { findArticleBySlug } from "@softure-ai/blog/server";
import { seo } from "@softure-ai/seo";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticleText, createTestBlog, type TestBlog } from "./support.js";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));
const APP_DIR = fileURLToPath(new URL("./fixtures/app/", import.meta.url));

const INDEXNOW_OFF = "indexnow: off, the seo module is not enabled; add seo({ indexNow: { key } }) to modules";
const CACHE_OFF = "cache: the running app shows the change within revalidateSeconds (300 s); set BLOG_REFRESH_SECRET to refresh it now";
const REFRESH_SECRET = "a-test-refresh-secret-of-40-characters!!";

function toHref(url: string | URL | Request): string {
  return typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
}

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
    // The fixture articles are too short for the quality gate; the gate has its own tests.
    test = await createTestBlog({ contentDir: "content", quality: false });
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
      // Never the developer's own BLOG_REFRESH_SECRET.
      env: {},
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
        CACHE_OFF,
        INDEXNOW_OFF,
      ],
      errors: [],
    });
    expect(await findArticleBySlug(test.ctx, "index-funds")).toBeNull();
    expect([opened, closed]).toEqual([1, 1]);
  });

  it("writes with --commit; the same files again are unchanged", async () => {
    expect((await run(["publish", "content", "--commit"])).lines.slice(-3)).toEqual(["written", CACHE_OFF, INDEXNOW_OFF]);
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ status: "published", isPillar: true });
    expect((await run(["publish", "content/index-funds.md", "--commit"])).lines).toEqual([
      "unchanged index-funds published/index-funds -> published/index-funds",
      "summary: added 0, changed 0, unchanged 1",
      "written",
      "cache: no text changed, nothing to refresh",
      INDEXNOW_OFF,
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
        lines: ["changed index-funds published/funds -> withdrawn/funds", "summary: added 0, changed 1, unchanged 0", "written", CACHE_OFF, INDEXNOW_OFF],
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
    for (const argv of [[], ["push"], ["publish", "--force"], ["publish", "a.md", "b.md", "--withdraw"], ["publish", "--withdraw"], ["publish", "--app-url", "web:3000"], ["publish", "--app-url", "ftp://web"]]) {
      const result = await run(argv);
      expect(result.code, argv.join(" ")).toBe(2);
    }
    expect((await run(["publish", "--force"])).errors[0]).toMatch(/^softure-blog: Unknown option '--force'/);
    expect((await run(["publish", "--app-url", "ftp://web"])).errors[0]).toBe('softure-blog: --app-url needs an http or https origin, e.g. http://web:3000, not "ftp://web"');
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

  const stdin = (text: string) => ({ readStdin: () => Promise.resolve(text) });

  it("publishes one file read from standard input", async () => {
    const text = readFileSync(join(FIXTURES_DIR, "content", "index-funds.md"), "utf8");
    expect((await run(["publish", "--stdin", "--name", "index-funds.md", "--commit"], stdin(text))).lines.slice(0, 3)).toEqual([
      "added index-funds none -> published/index-funds",
      "summary: added 1, changed 0, unchanged 0",
      "written",
    ]);
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ status: "published" });
  });

  it("publishes a JSON bundle of files read from standard input", async () => {
    const files = ["index-funds.md", "tax-wrapper.md"].map((name) => ({ name, text: readFileSync(join(FIXTURES_DIR, "content", name), "utf8") }));
    const result = await run(["publish", "--stdin"], stdin(JSON.stringify({ files })));
    expect(result.lines.slice(0, 2)).toEqual(["added index-funds none -> published/index-funds", "added tax-wrapper none -> draft/tax-wrapper"]);
  });

  it("refuses what standard input cannot give, before opening the database", async () => {
    expect((await run(["publish", "--stdin"], stdin("not json"))).errors).toEqual([
      'softure-blog publish: standard input is not a JSON bundle {"files":[{"name":"<slug>.md","text":"..."}]}; pass --name <slug>.md for one file',
    ]);
    expect((await run(["publish", "--stdin"], stdin('{"files":[{"name":"a.txt","text":""}]}'))).errors).toEqual([
      "softure-blog publish: the bundle on standard input: files.0.name: must be a file name <slug>.md",
    ]);
    expect((await run(["publish", "--stdin", "--name", "a.md"], stdin(" \n"))).errors).toEqual(["softure-blog publish: standard input is empty; pipe the text of a.md"]);
    expect((await run(["publish", "--stdin"], { readStdin: () => Promise.reject(new Error("EAGAIN")) })).errors).toEqual(["softure-blog publish: cannot read standard input: EAGAIN"]);
    expect(opened).toBe(0);
  });

  it("refuses --stdin with paths, --name without --stdin and a bad --name or --format", async () => {
    const cases: [string[], string][] = [
      [["publish", "--stdin", "content"], "softure-blog: --stdin reads the files from standard input; give no paths with it"],
      [["publish", "--name", "a.md"], "softure-blog: --name names the file --stdin reads; use it with --stdin"],
      [["publish", "--stdin", "--name", "dir/a.md"], 'softure-blog: --name needs a file name <slug>.md, not "dir/a.md"'],
      [["publish", "--stdin", "--withdraw"], "softure-blog: --withdraw takes exactly one article file"],
      [["publish", "--format", "json"], 'softure-blog: --format is text or lines, not "json"'],
    ];
    for (const [argv, error] of cases) {
      const result = await run(argv);
      expect([result.code, result.errors[0]], argv.join(" ")).toEqual([2, error]);
    }
  });

  it("prints the line contract with --format lines", async () => {
    expect(await run(["publish", "--format", "lines"])).toEqual({
      code: 0,
      lines: [
        "blog|change|added|index-funds|none|published/index-funds",
        "blog|change|added|tax-wrapper|none|draft/tax-wrapper",
        "blog|summary|2|0|0",
        "blog|dry-run",
        "blog|cache|off|300",
        "blog|indexnow|off|the seo module is not enabled; add seo({ indexNow: { key } }) to modules",
      ],
      errors: [],
    });
    expect((await run(["publish", "--format", "lines", "--commit", "--no-indexnow"])).lines.slice(-2)).toEqual(["blog|written", "blog|cache|off|300"]);
    const refused = await run(["publish", "--format", "lines"], { gate: () => ["too | short\nreally"] });
    expect(refused).toEqual({ code: 1, lines: ["blog|error|index-funds.md|quality gate: too   short really", "blog|refused"], errors: [] });
    expect(await run(["publish", "missing", "--format", "lines"])).toEqual({ code: 1, lines: [`blog|failed|cannot read ${FIXTURES_DIR}missing`], errors: [] });
  });

  it("imports the articles' history with --history", async () => {
    const dir = mkdtempSync(join(tmpdir(), "softure-blog-"));
    try {
      const historyPath = join(dir, "history.json");
      writeFileSync(historyPath, JSON.stringify({ articles: [{ id: "index-funds", published_at: "2026-02-01T09:00:00Z", old_slugs: [{ slug: "index-fund" }] }] }));
      writeFileSync(join(dir, "index-funds.md"), buildArticleText({ published_at: undefined }));
      expect((await run(["publish", join(dir, "index-funds.md"), "--history", historyPath, "--commit", "--format", "lines"])).lines.slice(0, 3)).toEqual([
        "blog|change|added|index-funds|none|published/index-funds",
        "blog|imported|index-funds|2026-02-01T09:00:00.000Z|1",
        "blog|summary|1|0|0",
      ]);
      writeFileSync(historyPath, '{"articles":[{"id":"x"}]}');
      expect((await run(["publish", "--history", historyPath])).errors).toEqual([`softure-blog publish: ${historyPath}: articles.0.published_at: is required: an ISO 8601 timestamp, or null for a text that was never published`]);
      expect((await run(["publish", "--history", join(dir, "none.json")])).errors).toEqual([`softure-blog publish: cannot read ${join(dir, "none.json")}`]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("softure-blog publish with seo({ indexNow })", () => {
  const KEY = "5f0c8a2e7b1d4c39a6e8f2b7d0c4a913";
  let test: TestBlog;
  let requests: { url: string; body: unknown }[];

  beforeEach(async () => {
    test = await createTestBlog({ contentDir: "content", quality: false }, [seo({ origin: "https://www.example.com", canonical: { host: "apex" }, indexNow: { key: KEY } })]);
    requests = [];
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function run(argv: string[], status = 200, refresh: { env: Record<string, string>; status?: number } = { env: {} }) {
    const { output, lines, errors } = createOutput();
    const code = await runBlogCli({
      config: test.config,
      argv,
      cwd: FIXTURES_DIR,
      output,
      clock: test.clock,
      openDatabase: () => Promise.resolve({ kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve() }),
      indexNowFetch: (url, init) => {
        requests.push({ url: toHref(url), body: JSON.parse(typeof init?.body === "string" ? init.body : "null") });
        return Promise.resolve(new Response(null, { status }));
      },
      env: refresh.env,
      refreshFetch: (url, init) => {
        requests.push({ url: toHref(url), body: new Headers(init?.headers).get("authorization") });
        return Promise.resolve(new Response(null, { status: refresh.status ?? 204 }));
      },
    });
    return { code, lines, errors };
  }

  it("refreshes the running app's cache before the IndexNow submit", async () => {
    const result = await run(["publish", "--commit"], 200, { env: { BLOG_REFRESH_SECRET: REFRESH_SECRET } });
    expect(result.lines.slice(-2)).toEqual(["cache: refreshed https://app.example.com/api/blog/refresh", "indexnow: submitted 2 URL(s) (200): /blog/index-funds /blog"]);
    expect(requests.map((request) => request.url)).toEqual(["https://app.example.com/api/blog/refresh", "https://api.indexnow.org/indexnow"]);
    expect(requests[0]?.body).toBe(`Bearer ${REFRESH_SECRET}`);
  });

  it("refreshes on the origin --app-url gives, also with --no-indexnow, and prints the address on a dry run", async () => {
    const env = { BLOG_REFRESH_SECRET: REFRESH_SECRET };
    expect((await run(["publish", "--app-url", "http://web:3000/ignored"], 200, { env })).lines.slice(-2, -1)).toEqual(["cache: dry run, a commit would refresh http://web:3000/api/blog/refresh"]);
    expect(requests).toEqual([]);
    expect((await run(["publish", "--commit", "--no-indexnow", "--app-url", "http://web:3000"], 200, { env })).lines.slice(-1)).toEqual(["cache: refreshed http://web:3000/api/blog/refresh"]);
    expect(requests.map((request) => request.url)).toEqual(["http://web:3000/api/blog/refresh"]);
  });

  it("keeps exit code 0 and still submits to IndexNow when the app refuses the refresh", async () => {
    const result = await run(["publish", "--commit"], 200, { env: { BLOG_REFRESH_SECRET: REFRESH_SECRET }, status: 401 });
    expect(result).toMatchObject({
      code: 0,
      errors: [
        "warning cache: https://app.example.com/api/blog/refresh answered 401 (the app has another BLOG_REFRESH_SECRET) (blog.refresh_rejected); the publish is written, the app shows it within 300 s",
      ],
    });
    expect(result.lines.slice(-1)).toEqual(["indexnow: submitted 2 URL(s) (200): /blog/index-funds /blog"]);
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ status: "published" });
  });

  it("prints the URLs a commit would submit on a dry run and sends nothing", async () => {
    expect((await run(["publish"])).lines.slice(-1)).toEqual([
      "indexnow: dry run, a commit would submit 2 URL(s): https://example.com/blog/index-funds https://example.com/blog",
    ]);
    expect(requests).toEqual([]);
  });

  it("submits the changed addresses on the seo origin after a commit, and nothing for an unchanged run", async () => {
    expect((await run(["publish", "--commit"])).lines.slice(-1)).toEqual(["indexnow: submitted 2 URL(s) (200): /blog/index-funds /blog"]);
    expect(requests).toEqual([
      {
        url: "https://api.indexnow.org/indexnow",
        body: { host: "example.com", key: KEY, keyLocation: "https://example.com/indexnow-key.txt", urlList: ["https://example.com/blog/index-funds", "https://example.com/blog"] },
      },
    ]);
    expect((await run(["publish", "--commit"])).lines.slice(-1)).toEqual(["indexnow: no public address changed, nothing to submit"]);
    expect(requests).toHaveLength(1);
  });

  it("submits the new and the old address after a rename, and the address of a withdrawn text", async () => {
    await run(["publish", "--commit"]);
    const dir = mkdtempSync(join(tmpdir(), "softure-blog-"));
    try {
      writeFileSync(join(dir, "funds.md"), buildArticleText({ id: "index-funds", slug: "funds", cluster: "investing-basics", pillar: true }));
      expect((await run(["publish", join(dir, "funds.md"), "--commit"])).lines.slice(-1)).toEqual(["indexnow: submitted 3 URL(s) (200): /blog/funds /blog/index-funds /blog"]);
      expect((await run(["publish", join(dir, "funds.md"), "--withdraw", "--commit"])).lines.slice(-1)).toEqual(["indexnow: submitted 2 URL(s) (200): /blog/funds /blog"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps exit code 0 when IndexNow refuses, with a warning that names the addresses", async () => {
    expect(await run(["publish", "--commit"], 403)).toMatchObject({
      code: 0,
      errors: ["warning indexnow: IndexNow answered 403 for 2 URLs (seo.indexnow_rejected); the publish is written, submit the addresses later: /blog/index-funds /blog"],
    });
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ status: "published" });
  });

  it("sends nothing with --no-indexnow", async () => {
    const result = await run(["publish", "--commit", "--no-indexnow"]);
    expect(result.lines.slice(-2)).toEqual(["written", CACHE_OFF]);
    expect(requests).toEqual([]);
  });

  it("says when seo has no IndexNow key", async () => {
    await test.database.close();
    test = await createTestBlog({ contentDir: "content", quality: false }, [seo()]);
    expect((await run(["publish"])).lines.slice(-1)).toEqual(["indexnow: off, seo has no IndexNow key; set seo({ indexNow: { key } })"]);
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

  describe("with a config without a database URL", () => {
    let appDir: string;

    beforeEach(() => {
      expect(process.env.SOFTURE_FIXTURE_UNSET_DATABASE_URL).toBeUndefined();
      // Inside the fixtures, so the copy resolves the packages and `../content`.
      appDir = mkdtempSync(join(FIXTURES_DIR, "tmp-"));
      copyFileSync(join(FIXTURES_DIR, "without-database.config.mjs"), join(appDir, "softure.config.mjs"));
    });

    afterEach(() => rmSync(appDir, { recursive: true, force: true }));

    it("runs check, which never connects", async () => {
      const result = await runBin(["check"], appDir);
      expect(result.errors).toEqual([]);
      expect(result.lines.at(-1)).toMatch(/^check: 2 file\(s\), \d+ error\(s\), \d+ warning\(s\)/);
    });

    it("runs skill install and skill install --check, which never connect", async () => {
      const install = await runBin(["skill", "install"], appDir);
      expect(install.errors).toEqual([]);
      expect(install).toMatchObject({ code: 0 });
      expect(install.lines.at(-1)).toMatch(/^skill: installed into \.claude\/skills\/blog-write/);

      const check = await runBin(["skill", "install", "--check"], appDir);
      expect(check).toMatchObject({ code: 0, errors: [], lines: ["skill: .claude/skills/blog-write is up to date"] });
    });

    it("reports a brand font check cannot read, with the loader's message", async () => {
      const config = readFileSync(join(appDir, "softure.config.mjs"), "utf8");
      const withFonts = config.replace('blog({ contentDir: "../content" })', 'blog({ contentDir: "../content", brand: { name: "Example", fonts: [{ name: "Inter", src: "assets/missing.woff" }] } })');
      expect(withFonts).not.toBe(config);
      writeFileSync(join(appDir, "softure.config.mjs"), withFonts);

      const result = await runBin(["check"], appDir);
      expect(result.code).toBe(1);
      expect(result.errors).toEqual([`softure-blog check: Blog OG card: brand.fonts[0] "assets/missing.woff": the file cannot be read (ENOENT) (${join(appDir, "assets/missing.woff")}).`]);
      expect(result.lines.at(-1)).toMatch(/^check: 2 file\(s\), [1-9]\d* error\(s\), \d+ warning\(s\): red, do not publish$/);
    });

    it("still refuses publish, which needs the database", async () => {
      const result = await runBin(["publish"], appDir);
      expect(result.code).toBe(1);
      expect(result.errors).toEqual([
        "softure-blog publish: createDatabase: the database URL is empty; set database.url in softure.config (usually from DATABASE_URL)",
      ]);
    });
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
