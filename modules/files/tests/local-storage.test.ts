// The local disk driver: atomic writes, ranges, deletes, key checks and the health probe, on a temporary folder.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorage } from "@softure-ai/files/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chunked, readText } from "./support.js";

describe("the local storage driver", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "softure-files-local-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("touches nothing until the first write", () => {
    createLocalStorage({ dir: join(dir, "data") });
    expect(existsSync(join(dir, "data"))).toBe(false);
  });

  it("writes an object under its key, reads it whole or by range, and sizes it", async () => {
    const storage = createLocalStorage({ dir: join(dir, "data") });

    await storage.put(chunked("0123456789"), "ab/cd/one");

    expect(readFileSync(join(dir, "data/ab/cd/one"), "utf8")).toBe("0123456789");
    expect(await readText((await storage.get("ab/cd/one")) as ReadableStream<Uint8Array>)).toBe("0123456789");
    expect(
      await readText(
        (await storage.get("ab/cd/one", {
          start: 3,
          end: 5,
        })) as ReadableStream<Uint8Array>,
      ),
    ).toBe("345");
    expect(await storage.head("ab/cd/one")).toEqual({ size: 10 });
    expect(await storage.get("ab/cd/two")).toBeNull();
    expect(await storage.head("ab/cd/two")).toBeNull();
  });

  it("leaves no file, partial or whole, when the body fails half way", async () => {
    const storage = createLocalStorage({ dir });
    async function* broken(): AsyncGenerator<Uint8Array> {
      await Promise.resolve();
      yield Buffer.from("half");
      throw new Error("body failed");
    }

    await expect(storage.put(broken(), "ab/cd/one")).rejects.toThrow("body failed");
    expect(readdirSync(join(dir, "ab/cd"))).toEqual([]);
  });

  it("deletes an object, and deleting a missing one is fine", async () => {
    const storage = createLocalStorage({ dir });
    await storage.put(chunked("x"), "ab/cd/one");

    await storage.delete("ab/cd/one");
    await storage.delete("ab/cd/one");

    expect(await storage.head("ab/cd/one")).toBeNull();
  });

  it.each(["../escape", "/abs", "ab//cd", "AB/cd", "ab/./cd", ""])("refuses the key %j", async (key) => {
    const storage = createLocalStorage({ dir });
    await expect(storage.put(chunked("x"), key)).rejects.toThrow(RangeError);
    await expect(storage.get(key)).rejects.toThrow(RangeError);
  });

  it("reports a writable folder and its free space, and an unwritable one", async () => {
    const storage = createLocalStorage({ dir });
    const check = await storage.check?.();
    expect(check?.isWritable).toBe(true);
    expect(check?.freeBytes).toBeGreaterThan(0);
    expect(readdirSync(join(dir, ".health"))).toEqual([]);

    const blocked = createLocalStorage({ dir: join(dir, "file-not-folder") });
    await createLocalStorage({ dir }).put(chunked("x"), "file-not-folder");
    expect((await blocked.check?.())?.isWritable).toBe(false);
  });
});
