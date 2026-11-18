import { describe, expect, it } from "vitest";
import { createGithubClient } from "../src/github.js";
import { DEFAULT_PRICES } from "../src/prices.js";
import { buildComment, buildIssueBody, MAX_BODY, publishReport } from "../src/publish.js";
import { buildReport, REPORT_MARKER, renderMarkdown } from "../src/report.js";
import { createFakeGithub } from "./fake-github.js";
import { makeJob } from "./fixtures.js";

const REPORT = buildReport({
  collected: [{ repository: "acme/app", jobs: [makeJob({ seconds: 120 })], partial: [], runs: { counted: 1, fromCache: 0, running: 0, skipped: 0 }, cache: { version: 1, runs: {} }, error: null }],
  from: new Date("2026-11-11T06:30:00Z"),
  to: new Date("2026-11-18T06:30:00Z"),
  generatedAt: new Date("2026-11-18T06:30:00Z"),
  priceOptions: { prices: DEFAULT_PRICES, ubicloudPremium: false },
});
const MARKDOWN = renderMarkdown(REPORT);
const RUN_URL = "https://github.com/acme/app/actions/runs/77";

describe("buildIssueBody", () => {
  it("puts the JSON in a collapsed block when it fits", () => {
    const body = buildIssueBody(MARKDOWN, REPORT);
    expect(body).toContain(REPORT_MARKER);
    expect(body).toContain("<details><summary>The report as JSON</summary>");
    expect(body).toContain(JSON.stringify(REPORT));
  });

  it("points to the artifact when the JSON would not fit, and never exceeds the limit", () => {
    const long = `${MARKDOWN}\n${"x".repeat(MAX_BODY - MARKDOWN.length - 200)}`;
    const body = buildIssueBody(long, REPORT);
    expect(body).not.toContain("<details>");
    expect(body).toContain("artifact `ci-usage-report`");
    expect(buildIssueBody("y".repeat(MAX_BODY * 2), REPORT).length).toBeLessThanOrEqual(MAX_BODY);
  });
});

describe("buildComment", () => {
  it("states the period, the totals and the run", () => {
    expect(buildComment(REPORT, RUN_URL)).toBe("2026-11-11 06:30 to 2026-11-18 06:30 UTC: 2 minutes, 0.01 USD estimated, 1 runs. [Run](https://github.com/acme/app/actions/runs/77)");
  });
});

describe("publishReport", () => {
  const isIssues = (url: URL): boolean => url.pathname === "/repos/acme/app/issues";

  it("creates the label and the issue the first time, then comments", async () => {
    const fake = createFakeGithub([
      { match: (url) => url.pathname === "/repos/acme/app/labels/ci-usage", status: 404, body: { message: "Not Found" } },
      { match: (url) => url.pathname === "/repos/acme/app/labels", status: 201, body: {} },
      { match: (url) => isIssues(url) && url.search !== "", body: [{ number: 3, body: "someone else's", html_url: "https://github.com/acme/app/issues/3" }] },
      { match: isIssues, status: 201, body: { number: 9, body: "", html_url: "https://github.com/acme/app/issues/9" } },
      { match: (url) => url.pathname === "/repos/acme/app/issues/9/comments", status: 201, body: {} },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await publishReport({ client, repository: "acme/app", report: REPORT, markdown: MARKDOWN, runUrl: RUN_URL });

    expect(result).toEqual({ ok: true, issue: 9, url: "https://github.com/acme/app/issues/9", created: true });
    expect(fake.requests.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
      "GET /repos/acme/app/labels/ci-usage",
      "POST /repos/acme/app/labels",
      "GET /repos/acme/app/issues",
      "POST /repos/acme/app/issues",
      "POST /repos/acme/app/issues/9/comments",
    ]);
    expect(fake.requests[3]?.body).toMatchObject({ title: "CI usage report", labels: ["ci-usage"] });
  });

  it("replaces the body of the oldest issue that carries the marker", async () => {
    const fake = createFakeGithub([
      { match: (url) => url.pathname === "/repos/acme/app/labels/ci-usage", body: { name: "ci-usage" } },
      {
        match: (url) => isIssues(url) && url.search !== "",
        body: [
          { number: 12, body: REPORT_MARKER, html_url: "https://github.com/acme/app/issues/12" },
          { number: 5, body: `intro ${REPORT_MARKER}`, html_url: "https://github.com/acme/app/issues/5" },
          { number: 4, body: REPORT_MARKER, html_url: "https://github.com/acme/app/pull/4", pull_request: {} },
        ],
      },
      { match: (url) => url.pathname === "/repos/acme/app/issues/5", body: { number: 5, body: "", html_url: "https://github.com/acme/app/issues/5" } },
      { match: (url) => url.pathname === "/repos/acme/app/issues/5/comments", status: 201, body: {} },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await publishReport({ client, repository: "acme/app", report: REPORT, markdown: MARKDOWN, runUrl: RUN_URL });
    expect(result).toEqual({ ok: true, issue: 5, url: "https://github.com/acme/app/issues/5", created: false });
    expect(fake.requests.find((request) => request.method === "PATCH")?.url.pathname).toBe("/repos/acme/app/issues/5");
  });

  it("returns a refused write as a value naming the request", async () => {
    const fake = createFakeGithub([
      { match: (url) => url.pathname === "/repos/acme/app/labels/ci-usage", body: { name: "ci-usage" } },
      { match: (url) => isIssues(url) && url.search !== "", body: [] },
      { match: isIssues, status: 403, body: { message: "Resource not accessible by integration" } },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    expect(await publishReport({ client, repository: "acme/app", report: REPORT, markdown: MARKDOWN, runUrl: RUN_URL })).toEqual({
      ok: false,
      error: "POST /repos/acme/app/issues answered 403: Resource not accessible by integration",
    });
  });
});
