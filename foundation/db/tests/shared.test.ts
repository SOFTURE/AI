import { closeSharedDatabases, getSharedDatabase } from "@softure-ai/db";
import { afterEach, describe, expect, it } from "vitest";

describe("getSharedDatabase", () => {
  afterEach(async () => {
    await closeSharedDatabases();
  });

  it("returns the same handle for the same URL", async () => {
    const first = await getSharedDatabase("pglite://");
    const second = await getSharedDatabase("pglite://");
    expect(second).toBe(first);
  });

  it("opens a new handle once the shared ones are closed", async () => {
    const first = await getSharedDatabase("pglite://");
    await closeSharedDatabases();
    const second = await getSharedDatabase("pglite://");
    expect(second).not.toBe(first);
  });

  it("does not keep a failed open, so the next call reports the problem again", async () => {
    await expect(getSharedDatabase("mysql://localhost/app")).rejects.toThrow('unsupported database URL scheme "mysql:"');
    await expect(getSharedDatabase("mysql://localhost/app")).rejects.toThrow('unsupported database URL scheme "mysql:"');
  });
});
