import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEV_BUILD_VERSION, getBuildVersion, readBuildVersion } from "@softure-ai/pwa/next";
import { afterEach, describe, expect, it, vi } from "vitest";

const dirs: string[] = [];

function createAppDir(buildId: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "softure-pwa-build-"));
  dirs.push(dir);
  if (buildId !== null) {
    mkdirSync(join(dir, ".next"));
    writeFileSync(join(dir, ".next", "BUILD_ID"), buildId);
  }
  return dir;
}

describe("the build version", () => {
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("takes SOFTURE_BUILD_VERSION over .next/BUILD_ID when it is set", () => {
    vi.stubEnv("SOFTURE_BUILD_VERSION", " v2026.11.16-3 ");
    expect(getBuildVersion(createAppDir("from-file"))).toBe("v2026.11.16-3");
  });

  it("on Cloudflare Workers takes SOFTURE_BUILD_VERSION, since there is no .next folder", () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    vi.stubEnv("SOFTURE_BUILD_VERSION", "abc123");
    expect(getBuildVersion(createAppDir(null))).toBe("abc123");
  });

  it("on Cloudflare Workers without SOFTURE_BUILD_VERSION fails naming it, instead of a dev version that never updates", () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    vi.stubEnv("SOFTURE_BUILD_VERSION", "");
    expect(() => getBuildVersion(createAppDir(null))).toThrow(
      "@softure-ai/pwa: set SOFTURE_BUILD_VERSION on Cloudflare Workers (a Worker has no .next/BUILD_ID)",
    );
  });

  it("reads .next/BUILD_ID, trimmed", () => {
    expect(readBuildVersion(createAppDir("Xk2_abc\n"))).toBe("Xk2_abc");
  });

  it.each([
    { name: "no build", buildId: null },
    { name: "an empty BUILD_ID", buildId: " \n" },
  ])("is dev with $name", ({ buildId }) => {
    expect(readBuildVersion(createAppDir(buildId))).toBe(DEV_BUILD_VERSION);
  });

  it("fails with the path when BUILD_ID cannot be read for another reason", () => {
    const dir = createAppDir(null);
    mkdirSync(join(dir, ".next", "BUILD_ID"), { recursive: true });

    expect(() => readBuildVersion(dir)).toThrow(`reading ${join(dir, ".next", "BUILD_ID")} failed`);
  });

  it("is read once per process: a later build in the same folder keeps the first version", () => {
    const dir = createAppDir("first");
    expect(getBuildVersion(dir)).toBe("first");

    writeFileSync(join(dir, ".next", "BUILD_ID"), "second");

    expect(getBuildVersion(dir)).toBe("first");
    expect(readBuildVersion(dir)).toBe("second");
  });
});
