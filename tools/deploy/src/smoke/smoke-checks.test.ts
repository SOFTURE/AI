import { describe, expect, it } from "vitest";
import { formatSmokeReport, runSmokeChecks, type SmokeBuildInfo } from "./smoke-checks.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const INFO: SmokeBuildInfo = { release: "v1.4.0", commit: SHA, builtAt: "2026-10-29T14:30:00.000Z", startedAt: "2026-10-29T15:01:00.000Z" };
const DEPLOYED_AT = new Date("2026-10-29T15:00:00.000Z");

describe("runSmokeChecks", () => {
  it("passes the release, the commit and the start time of the release just deployed", () => {
    expect(runSmokeChecks(INFO, { tag: "v1.4.0", commit: SHA, deployedAt: DEPLOYED_AT })).toEqual([
      { kind: "release", passed: true, detail: "release v1.4.0" },
      { kind: "commit", passed: true, detail: `commit ${SHA}` },
      { kind: "started", passed: true, detail: "started 2026-10-29T15:01:00.000Z, after the deploy at 2026-10-29T15:00:00.000Z" },
    ]);
  });

  it("checks only the release when neither the commit nor the deploy time is given", () => {
    expect(runSmokeChecks(INFO, { tag: "v1.4.0" }).map((check) => check.kind)).toEqual(["release"]);
  });

  it("fails another release and a missing one", () => {
    expect(runSmokeChecks(INFO, { tag: "v1.5.0" })[0]).toEqual({ kind: "release", passed: false, detail: "release v1.4.0, expected v1.5.0" });
    expect(runSmokeChecks({ ...INFO, release: null }, { tag: "v1.4.0" })[0]).toEqual({
      kind: "release",
      passed: false,
      detail: "no release (SOFTURE_RELEASE is unset in the container), expected v1.4.0",
    });
  });

  it("passes a short build commit that starts the tag's commit, in any case, and fails a shorter or another one", () => {
    const check = (commit: string | null) => runSmokeChecks({ ...INFO, commit }, { tag: "v1.4.0", commit: SHA })[1];
    expect(check("0123456")?.passed).toBe(true);
    expect(check("0123456789ABCDEF")?.passed).toBe(true);
    expect(check("012345")).toEqual({ kind: "commit", passed: false, detail: `commit 012345, expected ${SHA}` });
    expect(check("fedcba9876543210")?.passed).toBe(false);
    expect(check(null)).toEqual({
      kind: "commit",
      passed: false,
      detail: `no commit (the build did not set SOFTURE_BUILD_COMMIT), expected ${SHA}`,
    });
  });

  it("fails a process that started before the deploy beyond the tolerance, and passes one inside it", () => {
    const started = (startedAt: string, toleranceSeconds?: number) =>
      runSmokeChecks({ ...INFO, startedAt }, { tag: "v1.4.0", deployedAt: DEPLOYED_AT, ...(toleranceSeconds === undefined ? {} : { toleranceSeconds }) })[1];
    expect(started("2026-10-29T14:59:00.000Z")?.passed).toBe(true);
    expect(started("2026-10-29T14:58:59.000Z")).toEqual({
      kind: "started",
      passed: false,
      detail: "started 2026-10-29T14:58:59.000Z, before the deploy at 2026-10-29T15:00:00.000Z (tolerance 60 s): an old container answers",
    });
    expect(started("2026-10-29T14:59:59.000Z", 0)?.passed).toBe(false);
    expect(started("yesterday")).toEqual({ kind: "started", passed: false, detail: 'startedAt "yesterday" is not a time' });
  });
});

describe("formatSmokeReport", () => {
  it("prints one row per check under the URL", () => {
    const checks = runSmokeChecks(INFO, { tag: "v1.5.0", commit: SHA });
    expect(formatSmokeReport(checks, "https://example.com/api/health/build")).toBe(
      [
        "Build info of https://example.com/api/health/build",
        "Result  Check    Detail",
        "FAIL    release  release v1.4.0, expected v1.5.0",
        `PASS    commit   commit ${SHA}`,
        "",
      ].join("\n"),
    );
  });
});
