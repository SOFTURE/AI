// The next.config helper: the commit and the build time land in Next's `env`, next to the app's own entries.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBuildCommit, withBuildInfo } from "@softure-ai/ops/next-config";
import { afterEach, describe, expect, it, vi } from "vitest";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const BUILT_AT = new Date("2026-10-29T14:30:00.000Z");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withBuildInfo", () => {
  it("adds the commit and the build time to env and keeps the rest of the config", () => {
    const config = { poweredByHeader: false, env: { APP_NAME: "notes" } };
    expect(withBuildInfo(config, { commit: SHA, builtAt: BUILT_AT, env: {} })).toEqual({
      poweredByHeader: false,
      env: { APP_NAME: "notes", SOFTURE_BUILD_COMMIT: SHA, SOFTURE_BUILD_TIME: "2026-10-29T14:30:00.000Z" },
    });
    expect(config.env).toEqual({ APP_NAME: "notes" });
  });

  it("works on a config without env", () => {
    expect(withBuildInfo<{ env?: Record<string, string | undefined> }>({}, { commit: SHA, builtAt: BUILT_AT, env: {} }).env).toEqual({
      SOFTURE_BUILD_COMMIT: SHA,
      SOFTURE_BUILD_TIME: "2026-10-29T14:30:00.000Z",
    });
  });
});

describe("resolveBuildCommit", () => {
  it("takes the option first, then SOFTURE_BUILD_COMMIT, then GITHUB_SHA, lower-cased", () => {
    const env = { SOFTURE_BUILD_COMMIT: "ABCDEF1", GITHUB_SHA: SHA };
    expect(resolveBuildCommit({ commit: "1234567", env })).toBe("1234567");
    expect(resolveBuildCommit({ env })).toBe("abcdef1");
    expect(resolveBuildCommit({ env: { GITHUB_SHA: SHA } })).toBe(SHA);
  });

  it("skips a value that is not a commit, with a warning, and falls back to the next", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveBuildCommit({ env: { SOFTURE_BUILD_COMMIT: "main", GITHUB_SHA: SHA } })).toBe(SHA);
    expect(warn).toHaveBeenCalledWith('withBuildInfo: "main" is not a commit (7 to 64 hex digits); ignored.');
  });

  it("asks git when nothing else names the commit", () => {
    expect(resolveBuildCommit({ env: {}, cwd: import.meta.dirname })).toMatch(/^[0-9a-f]{40}$/);
  });

  it("answers an empty commit outside a repository with nothing set", () => {
    const dir = mkdtempSync(join(tmpdir(), "softure-ops-build-info-"));
    try {
      expect(resolveBuildCommit({ env: {}, cwd: dir })).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
