import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parsePeriod, parseRepositories, runCommand, type CommandContext } from "../src/cli/command.js";
import type { CiUsageReport } from "../src/report.js";
import { createFakeGithub, makeApiJob, makeRun, type FakeRoute } from "./fake-github.js";

const NOW = new Date("2026-11-18T06:30:00Z");
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ci-usage-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeContext(routes: FakeRoute[], env: NodeJS.ProcessEnv = { GITHUB_TOKEN: "t", GITHUB_REPOSITORY: "acme/app" }): CommandContext & { out: string[]; err: string[]; fake: ReturnType<typeof createFakeGithub> } {
  const out: string[] = [];
  const err: string[] = [];
  const fake = createFakeGithub(routes);
  return { cwd: dir, env, write: (text) => out.push(text), writeError: (text) => err.push(text), fetch: fake.fetch, now: () => NOW, out, err, fake };
}

const ROUTES: FakeRoute[] = [
  { match: (url) => url.pathname === "/repos/acme/app/actions/runs" && (url.searchParams.get("created") ?? "").startsWith("2026-11-17T00:00:00Z"), body: { total_count: 1, workflow_runs: [makeRun(1)] } },
  { match: (url) => url.pathname === "/repos/acme/app/actions/runs", body: { total_count: 0, workflow_runs: [] } },
  { match: (url) => url.pathname === "/repos/acme/app/actions/runs/1/jobs", body: { total_count: 1, jobs: [makeApiJob(11, 1)] } },
];

describe("parseRepositories", () => {
  it("splits commas and spaces, drops duplicates and defaults to GITHUB_REPOSITORY", () => {
    expect(parseRepositories(["acme/a, acme/b", "acme/a"], {})).toEqual({ ok: true, repositories: ["acme/a", "acme/b"] });
    expect(parseRepositories([""], { GITHUB_REPOSITORY: "acme/c" })).toEqual({ ok: true, repositories: ["acme/c"] });
    expect(parseRepositories(undefined, {})).toEqual({ ok: false, error: "--repository is required outside GitHub Actions (owner/name)" });
    expect(parseRepositories(["acme"], {})).toEqual({ ok: false, error: '--repository must be owner/name, not "acme"' });
  });
});

describe("parsePeriod", () => {
  it("defaults to the last seven days and takes dates or times", () => {
    expect(parsePeriod({}, NOW)).toEqual({ ok: true, from: new Date("2026-11-11T06:30:00Z"), to: NOW });
    expect(parsePeriod({ days: "1" }, NOW)).toEqual({ ok: true, from: new Date("2026-11-17T06:30:00Z"), to: NOW });
    expect(parsePeriod({ from: "2026-11-01", to: "2026-11-08" }, NOW)).toEqual({ ok: true, from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-08T00:00:00Z") });
  });

  it("refuses a bad number of days and a reversed or half period", () => {
    expect(parsePeriod({ days: "0" }, NOW).ok).toBe(false);
    expect(parsePeriod({ days: "32" }, NOW).ok).toBe(false);
    expect(parsePeriod({ to: "2026-11-08" }, NOW)).toEqual({ ok: false, error: "--to needs --from" });
    expect(parsePeriod({ from: "2026-11-08", to: "2026-11-01" }, NOW)).toEqual({ ok: false, error: "--from must be before --to" });
    expect(parsePeriod({ from: "soon" }, NOW)).toEqual({ ok: false, error: '--from must be a date (YYYY-MM-DD) or an ISO time, not "soon"' });
  });
});

describe("report", () => {
  it("writes the JSON, the Markdown and the cache, and prints one line per repository", async () => {
    const context = makeContext(ROUTES);
    const code = await runCommand(["report", "--days", "2", "--out-dir", "out", "--cache", "cache/runs.json"], context);
    expect(code).toBe(0);
    const report = JSON.parse(readFileSync(join(dir, "out/ci-usage.json"), "utf8")) as CiUsageReport;
    expect(report.totals).toMatchObject({ minutes: 3, runs: 1 });
    expect(readFileSync(join(dir, "out/ci-usage.md"), "utf8")).toContain("| acme/app | 3 | 0.02 | 3 | 0 | 0 | 1 |");
    expect(Object.keys((JSON.parse(readFileSync(join(dir, "cache/runs.json"), "utf8")) as { runs: object }).runs)).toEqual(["1:1"]);
    expect(context.out[0]).toBe("acme/app: 3 minutes, 0.02 USD, 1 runs\n");
  });

  it("reads an unchanged run from the cache on the next report", async () => {
    await runCommand(["report", "--days", "2", "--cache", "runs.json"], makeContext(ROUTES));
    const second = makeContext(ROUTES);
    await runCommand(["report", "--days", "2", "--cache", "runs.json"], second);
    expect(second.fake.requests.some((request) => request.url.pathname.endsWith("/jobs"))).toBe(false);
  });

  it("stops reading runs once --max-minutes has passed and marks the report partial", async () => {
    const context = makeContext(ROUTES);
    const times = [NOW, new Date(NOW.getTime() + 6 * 60_000)];
    context.now = () => times.shift() ?? new Date(NOW.getTime() + 60 * 60_000);
    expect(await runCommand(["report", "--days", "2", "--max-minutes", "5"], context)).toBe(0);
    const report = JSON.parse(readFileSync(join(dir, "ci-usage.json"), "utf8")) as CiUsageReport;
    expect(report.partial).toBe(true);
    expect(report.repositories[0]?.partial).toEqual(["stopped at the time budget: 1 of 1 runs not counted"]);
    expect(context.fake.requests.some((request) => request.url.pathname.endsWith("/jobs"))).toBe(false);
  });

  it("exits 1 when no repository could be read", async () => {
    const context = makeContext([{ match: () => true, status: 404, body: { message: "Not Found" } }]);
    expect(await runCommand(["report", "--days", "1"], context)).toBe(1);
    expect(context.out[0]).toBe("acme/app: not read (GET /repos/acme/app/actions/runs answered 404: Not Found)\n");
    expect(existsSync(join(dir, "ci-usage.md"))).toBe(true);
  });

  it("lists every input error at once, with the usage", async () => {
    const context = makeContext([], {});
    expect(await runCommand(["report", "--days", "x", "--prices", "{", "--billing", "team:x", "--max-minutes", "0"], context)).toBe(1);
    const message = context.err.join("");
    for (const part of ["--repository is required", "--days must be", "--prices is not JSON", "--billing must be", '--max-minutes must be a whole number of minutes, 1 or more, not "0"', "GITHUB_TOKEN (or GH_TOKEN) is not set", "Usage:"]) {
      expect(message).toContain(part);
    }
  });

  it("answers an unknown option and an unknown command with the usage", async () => {
    const context = makeContext([]);
    expect(await runCommand(["report", "--nope"], context)).toBe(1);
    expect(await runCommand(["fly"], context)).toBe(1);
    expect(context.err.join("")).toContain('Unknown command "fly".');
  });
});

describe("publish", () => {
  it("needs the report files first", async () => {
    const context = makeContext([]);
    expect(await runCommand(["publish"], context)).toBe(1);
    expect(context.err.join("")).toContain("run report first");
  });

  it("publishes to the repository with the run's address", async () => {
    await runCommand(["report", "--days", "2"], makeContext(ROUTES));
    const context = makeContext(
      [
        { match: (url) => url.pathname.endsWith("/labels/ci-usage"), body: { name: "ci-usage" } },
        { match: (url) => url.pathname === "/repos/acme/app/issues" && url.search !== "", body: [] },
        { match: (url) => url.pathname === "/repos/acme/app/issues", status: 201, body: { number: 2, html_url: "https://github.com/acme/app/issues/2" } },
        { match: (url) => url.pathname === "/repos/acme/app/issues/2/comments", status: 201, body: {} },
      ],
      { GITHUB_TOKEN: "t", GITHUB_REPOSITORY: "acme/app", GITHUB_SERVER_URL: "https://github.com", GITHUB_RUN_ID: "77" },
    );
    expect(await runCommand(["publish"], context)).toBe(0);
    expect(context.out).toEqual(["created https://github.com/acme/app/issues/2\n"]);
    expect(String((context.fake.requests.at(-1)?.body as { body: string }).body)).toContain("(https://github.com/acme/app/actions/runs/77)");
  });

  it("passes --close through: the report issue is found open or closed and closed again", async () => {
    await runCommand(["report", "--days", "2"], makeContext(ROUTES));
    const context = makeContext(
      [
        { match: (url) => url.pathname.endsWith("/labels/ci-usage"), body: { name: "ci-usage" } },
        { match: (url) => url.pathname === "/repos/acme/app/issues" && url.search !== "", body: [{ number: 4, body: "<!-- softure-ci-usage -->", html_url: "https://github.com/acme/app/issues/4" }] },
        { match: (url) => url.pathname === "/repos/acme/app/issues/4", body: { number: 4, html_url: "https://github.com/acme/app/issues/4" } },
        { match: (url) => url.pathname === "/repos/acme/app/issues/4/comments", status: 201, body: {} },
      ],
      { GITHUB_TOKEN: "t", GITHUB_REPOSITORY: "acme/app" },
    );
    expect(await runCommand(["publish", "--close"], context)).toBe(0);
    expect(context.fake.requests.find((request) => request.method === "PATCH")?.body).toMatchObject({ state: "closed", state_reason: "completed" });
  });

  it("reports a refused publication and exits 1", async () => {
    writeFileSync(join(dir, "ci-usage.json"), "{}");
    writeFileSync(join(dir, "ci-usage.md"), "x");
    const context = makeContext([{ match: () => true, status: 403, body: { message: "Forbidden" } }]);
    expect(await runCommand(["publish"], context)).toBe(1);
    expect(context.err.join("")).toBe("publishing the report to acme/app failed: GET /repos/acme/app/labels/ci-usage answered 403: Forbidden\n");
  });
});
