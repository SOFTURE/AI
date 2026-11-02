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

describe("runSmokeChecks with the app's own fields (issue #922)", () => {
  const ANSWER = { ...INFO, toolListVersion: "a1b2c3", toolCount: 12, beta: false, region: null, nested: { a: 1 } };

  it("passes every field that equals its expected value, after the build facts, in the order given", () => {
    const checks = runSmokeChecks(INFO, { tag: "v1.4.0", fields: { toolCount: 12, toolListVersion: "a1b2c3", beta: false, region: null } }, ANSWER);
    expect(checks).toEqual([
      { kind: "release", passed: true, detail: "release v1.4.0" },
      { kind: "field", field: "toolCount", passed: true, detail: "toolCount 12" },
      { kind: "field", field: "toolListVersion", passed: true, detail: 'toolListVersion "a1b2c3"' },
      { kind: "field", field: "beta", passed: true, detail: "beta false" },
      { kind: "field", field: "region", passed: true, detail: "region null" },
    ]);
  });

  it("fails another value, another type, an object and a missing field, showing both sides as JSON", () => {
    const field = (name: string, expected: string | number | boolean | null) =>
      runSmokeChecks(INFO, { tag: "v1.4.0", fields: { [name]: expected } }, ANSWER)[1];
    expect(field("toolListVersion", "d4e5f6")).toEqual({
      kind: "field",
      field: "toolListVersion",
      passed: false,
      detail: 'toolListVersion "a1b2c3", expected "d4e5f6"',
    });
    expect(field("toolCount", "12")?.detail).toBe('toolCount 12, expected "12"');
    expect(field("nested", 1)?.detail).toBe('nested {"a":1}, expected 1');
    expect(field("toolNames", "x")).toEqual({ kind: "field", field: "toolNames", passed: false, detail: 'no toolNames in the build info, expected "x"' });
  });

  it("reads fields from the build info itself when no whole answer is passed", () => {
    expect(runSmokeChecks(INFO, { tag: "v1.4.0", fields: { builtAt: "2026-10-29T14:30:00.000Z" } })[1]?.passed).toBe(true);
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

  it("names a field check after its field", () => {
    const checks = runSmokeChecks(INFO, { tag: "v1.4.0", fields: { toolListVersion: "b" } }, { ...INFO, toolListVersion: "a" });
    expect(formatSmokeReport(checks, "https://example.com/b")).toBe(
      [
        "Build info of https://example.com/b",
        "Result  Check            Detail",
        "PASS    release          release v1.4.0",
        'FAIL    toolListVersion  toolListVersion "a", expected "b"',
        "",
      ].join("\n"),
    );
  });
});
