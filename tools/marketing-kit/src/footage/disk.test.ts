import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findLowDiskProblems, getFreeBytes, getRenderTempDir, RENDER_MIN_FREE_BYTES } from "./disk.js";

const MiB = 1024 ** 2;

describe("findLowDiskProblems", () => {
  it("reports a temp folder with under 1 GiB free, naming it and the fix", () => {
    const problems = findLowDiskProblems({ temp: "/tmp" }, () => 300 * MiB);
    expect(problems).toEqual([
      "the temp folder /tmp has 0.3 GiB free and a hyperframes render needs 1.0 GiB; hyperframes extracts the clips' frames there (hundreds of MB per minute of film): point TMPDIR (or renderFootage's tempDir) at a data volume, not a small tmpfs.",
    ]);
  });

  it("accepts exactly 1 GiB, the limit hyperframes itself applies", () => {
    expect(findLowDiskProblems({ temp: "/tmp", build: "/data/build" }, () => RENDER_MIN_FREE_BYTES)).toEqual([]);
  });

  it("reports the build folder on its own", () => {
    const free: Record<string, number> = { "/data/tmp": 20 * 1024 * MiB, "/app/build": 512 * MiB };
    expect(findLowDiskProblems({ temp: "/data/tmp", build: "/app/build" }, (folder) => free[folder] ?? null)).toEqual([
      "the build folder /app/build has 0.5 GiB free and a hyperframes render needs 1.0 GiB; hyperframes writes the render there: free space or move buildDir to a larger disk.",
    ]);
  });

  it("checks a folder once when the temp and build folders are the same", () => {
    const read: string[] = [];
    const problems = findLowDiskProblems({ temp: "/tmp", build: "/tmp/" }, (folder) => {
      read.push(folder);
      return 0;
    });
    expect(read).toEqual(["/tmp"]);
    expect(problems).toHaveLength(1);
  });

  it("skips a folder whose free space cannot be read", () => {
    expect(findLowDiskProblems({ temp: "/tmp", build: "/build" }, () => null)).toEqual([]);
  });
});

describe("getRenderTempDir", () => {
  it("prefers the tempDir option", () => {
    expect(getRenderTempDir({ TMPDIR: "/tmp" }, "/data/tmp")).toBe("/data/tmp");
  });

  it("follows TMPDIR, then TMP, then TEMP of the environment hyperframes runs with", () => {
    expect(getRenderTempDir({ TMPDIR: "/a", TMP: "/b" })).toBe("/a");
    expect(getRenderTempDir({ TMP: "/b", TEMP: "/c" })).toBe("/b");
    expect(getRenderTempDir({ TEMP: "/c" })).toBe("/c");
  });

  it("falls back to this process's os.tmpdir()", () => {
    expect(getRenderTempDir({}, "")).toBe(tmpdir());
  });
});

describe("getFreeBytes", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-disk-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("measures a folder that does not exist yet on its nearest existing parent", () => {
    const existing = getFreeBytes(dir);
    expect(existing).toBeGreaterThan(0);
    expect(getFreeBytes(join(dir, "not", "yet"))).toBeGreaterThan(0);
  });
});
