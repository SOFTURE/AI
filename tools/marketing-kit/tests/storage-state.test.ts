import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { findStorageStateProblem, STORAGE_STATE_HINT } from "../src/screenshot/storage-state.js";

describe("findStorageStateProblem", () => {
  const dir = mkdtempSync(join(tmpdir(), "marketing-kit-storage-state-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("accepts a Playwright storage state", () => {
    const file = join(dir, "good.json");
    writeFileSync(file, JSON.stringify({ cookies: [], origins: [] }));
    expect(findStorageStateProblem(file)).toBeNull();
  });

  it("names a missing file and how to create one", () => {
    const file = join(dir, "missing.json");
    expect(findStorageStateProblem(file)).toBe(`the storage state ${file} does not exist; ${STORAGE_STATE_HINT}`);
  });

  it("refuses a file that is not JSON without quoting it", () => {
    const file = join(dir, "broken.json");
    writeFileSync(file, "session=secret-token");
    const problem = findStorageStateProblem(file);
    expect(problem).toBe(`the storage state ${file} is not JSON; ${STORAGE_STATE_HINT}`);
    expect(problem).not.toContain("secret-token");
  });

  it("refuses JSON without a cookies list", () => {
    const file = join(dir, "other.json");
    writeFileSync(file, JSON.stringify({ token: "x" }));
    expect(findStorageStateProblem(file)).toBe(`the storage state ${file} has no "cookies" list, so it is not a Playwright storage state; ${STORAGE_STATE_HINT}`);
  });
});
