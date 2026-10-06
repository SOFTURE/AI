import { describe, expect, it } from "vitest";
import { getDeployMessages } from "../messages/index.js";
import { getSectionMarkers, readSection, writeReleaseSection } from "./release-body.js";
import { parseDeployReport, parseServerLines, writeReleaseReport, type DeployReport } from "./release-report.js";

const en = getDeployMessages("en");
const STATUS = getSectionMarkers("status");
const DEPLOYMENTS = getSectionMarkers("deployments");

function buildReport(overrides: Partial<DeployReport> = {}): DeployReport {
  return {
    version: 1,
    tag: "v2026.10.06",
    environment: "production",
    image: "ghcr.io/acme/app:v2026.10.06",
    digest: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    runUrl: "https://github.com/acme/app/actions/runs/42/attempts/1",
    finishedAt: "2026-10-06T14:05:09Z",
    jobs: [
      { name: "check", result: "success" },
      { name: "build", result: "success" },
      { name: "deploy", result: "success" },
      { name: "verify", result: "success" },
    ],
    serverLines: [
      "step|archive|ok",
      "step|backup|ok|db-20261006-140501.dump",
      "step|row-counts-before|ok|users=3,billing.plans=2",
      "step|switch|ok",
      "step|row-counts-after|ok|users=4,billing.plans=2",
      "result|ok",
    ],
    ...overrides,
  };
}

const HEADER = "| When (UTC) | Result | Environment | Image | Database | Verify | Run |";

const FIRST_ROW =
  "| 2026-10-06 14:05 | ✅ deployed | production | `ghcr.io/acme/app:v2026.10.06`<br>`sha256:0123456789ab…` | " +
  "backup: `db-20261006-140501.dump`<br>rows: users 3 → 4, billing.plans 2 → 2 | ✅ success | " +
  "[run](https://github.com/acme/app/actions/runs/42/attempts/1) |";

describe("parseServerLines", () => {
  it("reads the result, the backup file and the counts before and after", () => {
    expect(parseServerLines(buildReport().serverLines)).toEqual({
      failedStep: null,
      backup: "db-20261006-140501.dump",
      counts: { counted: true, before: { users: 3, "billing.plans": 2 }, after: { users: 4, "billing.plans": 2 } },
    });
  });

  it("names the failed step and reads no counts when they were skipped", () => {
    expect(
      parseServerLines(["step|row-counts-before|ok|skipped", "step|switch|ok", "result|failed|switch|the stack did not become healthy"]),
    ).toEqual({ failedStep: "switch", backup: null, counts: { counted: false } });
  });

  it("reads nothing from an empty output (the deploy never reached the server)", () => {
    expect(parseServerLines([])).toEqual({ failedStep: null, backup: null, counts: null });
  });
});

describe("writeReleaseReport", () => {
  it("writes the status and a first deployment row under the owner's text and the release notes", () => {
    const owner = writeReleaseSection("First release.", "## v2026.10.06 (2026-10-06)");
    const body = writeReleaseReport(owner, buildReport(), en);

    expect(body.startsWith(owner.trimEnd())).toBe(true);
    expect(readSection(body, "status")).toBe(
      [
        "## Pipeline status",
        "",
        "| Job | Result |",
        "| --- | --- |",
        "| check | ✅ success |",
        "| build | ✅ success |",
        "| deploy | ✅ success |",
        "| verify | ✅ success |",
        "",
        "Run: [2026-10-06 14:05 UTC](https://github.com/acme/app/actions/runs/42/attempts/1)",
      ].join("\n"),
    );
    expect(readSection(body, "deployments")).toBe(["## Deployments", "", HEADER, "| --- | --- | --- | --- | --- | --- | --- |", FIRST_ROW].join("\n"));
    expect(body.indexOf(STATUS.open)).toBeLessThan(body.indexOf(DEPLOYMENTS.open));
  });

  it("replaces the status but prepends the next run's row and keeps the first byte for byte", () => {
    const first = writeReleaseReport("", buildReport(), en);
    const rerun = buildReport({
      runUrl: "https://github.com/acme/app/actions/runs/42/attempts/2",
      finishedAt: "2026-10-06T15:00:00Z",
      jobs: [
        { name: "check", result: "success" },
        { name: "build", result: "success" },
        { name: "deploy", result: "failure" },
        { name: "verify", result: "skipped" },
      ],
      serverLines: ["step|backup|ok|db-20261006-145950.dump", "result|failed|row-counts-after|rows were lost on v2026.10.06"],
    });
    const second = writeReleaseReport(first, rerun, en);

    const rows = (readSection(second, "deployments") ?? "").split("\n").slice(4);
    expect(rows).toEqual([
      "| 2026-10-06 15:00 | ❌ failed at row-counts-after | production | `ghcr.io/acme/app:v2026.10.06`<br>`sha256:0123456789ab…` | " +
        "backup: `db-20261006-145950.dump` | ⏭️ skipped | [run](https://github.com/acme/app/actions/runs/42/attempts/2) |",
      FIRST_ROW,
    ]);
    expect(readSection(second, "status")).toContain("| deploy | ❌ failure |");
    expect(readSection(second, "status")).not.toContain("attempts/1");
    expect(second.split(STATUS.open)).toHaveLength(2);
    expect(second.split(DEPLOYMENTS.open)).toHaveLength(2);
  });

  it("shows counts that are missing after the switch with a question mark", () => {
    const report = buildReport({
      serverLines: ["step|backup|ok|db-1.dump", "step|row-counts-before|ok|users=3", "result|failed|row-counts-after|rows were lost"],
      jobs: [{ name: "deploy", result: "failure" }],
    });
    expect(readSection(writeReleaseReport("", report, en), "deployments")).toContain("rows: users 3 → ?");
  });

  it("says when rows were not counted and leaves the database cell empty when nothing reached the server", () => {
    const skipped = buildReport({ serverLines: ["step|row-counts-before|ok|skipped", "result|ok"] });
    expect(readSection(writeReleaseReport("", skipped, en), "deployments")).toContain("| rows: not counted |");
    const nothing = buildReport({ serverLines: [], jobs: [{ name: "deploy", result: "cancelled" }] });
    expect(readSection(writeReleaseReport("", nothing, en), "deployments")).toContain("| ⛔ cancelled | production |");
    expect(readSection(writeReleaseReport("", nothing, en), "deployments")).toMatch(/\| — \| ⏳ pending \|/);
  });

  it("writes the status only when the deploy job was skipped (the run stopped before it)", () => {
    const report = buildReport({
      jobs: [
        { name: "check", result: "failure" },
        { name: "build", result: "skipped" },
        { name: "deploy", result: "skipped" },
        { name: "verify", result: "skipped" },
      ],
      serverLines: [],
    });
    const body = writeReleaseReport("", report, en);
    expect(readSection(body, "status")).toContain("| check | ❌ failure |");
    expect(readSection(body, "deployments")).toBeNull();
  });

  it("shortens a long digest only", () => {
    expect(readSection(writeReleaseReport("", buildReport({ digest: "sha256:abc" }), en), "deployments")).toContain("<br>`sha256:abc` |");
  });

  it("shows an unknown job result as pending and an empty environment as a dash", () => {
    const report = buildReport({ environment: "", jobs: [{ name: "deploy", result: "success" }, { name: "verify", result: "neutral" }] });
    const body = writeReleaseReport("", report, en);
    expect(readSection(body, "status")).toContain("| verify | ⏳ pending |");
    expect(readSection(body, "deployments")).toContain("| ✅ deployed | — |");
  });

  it("keeps a value with a pipe, an angle bracket, a backtick or a newline from breaking the table", () => {
    const report = buildReport({
      environment: "prod | <b>x</b>",
      serverLines: ["step|backup|ok|db`1<2>.dump", "result|ok"],
      jobs: [{ name: "deploy\n| injected |", result: "success" }],
    });
    const body = writeReleaseReport("", report, en);
    for (const section of ["status", "deployments"] as const) {
      const text = readSection(body, section) ?? "";
      expect(text).not.toMatch(/<b>|`1<|\n\| injected/);
    }
    expect(readSection(body, "deployments")).toContain("| prod ? ?b?x?/b? |");
  });

  it("writes Polish copy for --locale=pl", () => {
    const body = writeReleaseReport("", buildReport(), getDeployMessages("pl"));
    expect(readSection(body, "status")).toContain("## Status pipeline'u");
    expect(readSection(body, "deployments")).toContain(`✅ ${getDeployMessages("pl").releaseReport.deployed}`);
  });
});

describe("parseDeployReport", () => {
  it("accepts the summary the deploy workflow writes", () => {
    expect(parseDeployReport(JSON.parse(JSON.stringify(buildReport())))).toEqual({ ok: true, report: buildReport() });
  });

  it("refuses another version, a missing field, an extra field and a run URL that is not https", () => {
    const problemOf = (json: unknown): string => {
      const parsed = parseDeployReport(json);
      return parsed.ok ? "" : parsed.problem;
    };
    expect(problemOf({ ...buildReport(), version: 2 })).toContain("version");
    const noTag: Record<string, unknown> = { ...buildReport() };
    delete noTag.tag;
    expect(problemOf(noTag)).toContain("tag");
    expect(problemOf({ ...buildReport(), extra: 1 })).toContain("extra");
    expect(problemOf({ ...buildReport(), runUrl: "javascript:alert(1)" })).toContain("runUrl");
    expect(parseDeployReport("not an object").ok).toBe(false);
  });
});
