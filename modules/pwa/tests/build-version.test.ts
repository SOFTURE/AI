import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEV_BUILD_VERSION, getBuildVersion, readBuildVersion } from "@softure-ai/pwa/next";
import { afterEach, describe, expect, it } from "vitest";

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
