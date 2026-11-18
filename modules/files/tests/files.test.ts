// Reading, listing and deleting: only live files, an owner filter, ranges, and deletion that takes the bytes too.
import { deleteFile, findFile, listFiles, openFile, pruneFiles, saveFile, setFileExpiry } from "@softure-ai/files/server";
import type { StoredFile } from "@softure-ai/files";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BOB, chunked, HOUR_MS, createTestFiles, listRows, readText, type TestFiles } from "./support.js";

describe("stored files", () => {
  let test: TestFiles;

  async function save(name: string, content: string, ownerId = ALICE, kind = "file"): Promise<StoredFile> {
    const saved = await saveFile(test.ctx, {
      ownerId,
      body: chunked(content),
      name,
      kind,
    });
    if (!saved.ok) throw new Error(`setup: ${saved.error}`);
    test.clock.advance(1000);
    return saved.value;
  }

  beforeEach(async () => {
    test = await createTestFiles();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("finds a file by id, and only for its owner when asked", async () => {
    const file = await save("a.txt", "abc");

    expect(await findFile(test.ctx, file.id)).toEqual(file);
    expect(await findFile(test.ctx, file.id, { ownerId: ALICE })).toEqual(file);
    expect(await findFile(test.ctx, file.id, { ownerId: BOB })).toBeNull();
    expect(await findFile(test.ctx, "not-a-uuid")).toBeNull();
    expect(await findFile(test.ctx, "3f1c2b4a-5d6e-4f70-8192-a3b4c5d6e7f8")).toBeNull();
  });

  it("opens the whole file or a range of it, clipping the end", async () => {
    const file = await save("digits.txt", "0123456789");

    const whole = await openFile(test.ctx, file.id);
    const middle = await openFile(test.ctx, file.id, {
      range: { start: 2, end: 4 },
    });
    const tail = await openFile(test.ctx, file.id, {
      range: { start: 7, end: 100 },
    });

    expect(whole.ok && [await readText(whole.value.body), whole.value.range]).toEqual(["0123456789", null]);
    expect(middle.ok && [await readText(middle.value.body), middle.value.range]).toEqual(["234", { start: 2, end: 4 }]);
    expect(tail.ok && [await readText(tail.value.body), tail.value.range]).toEqual(["789", { start: 7, end: 9 }]);
    expect(await openFile(test.ctx, file.id, { range: { start: 10, end: 12 } })).toEqual({ ok: false, error: "files.range_not_satisfiable" });
    expect(await openFile(test.ctx, file.id, { range: { start: 5, end: 2 } })).toEqual({ ok: false, error: "files.range_not_satisfiable" });
    expect(await openFile(test.ctx, file.id, { ownerId: BOB })).toEqual({
      ok: false,
      error: "files.not_found",
    });
  });

  it("reads a file whose bytes are gone from storage as not found", async () => {
    const file = await save("a.txt", "abc");
    for (const key of test.storage.objects().keys()) await test.storage.delete(key);

    expect(await openFile(test.ctx, file.id)).toEqual({
      ok: false,
      error: "files.not_found",
    });
  });

  it("lists an owner's live files newest first, by kind, with a limit and an offset", async () => {
    const a = await save("a", "1", ALICE, "input");
    const b = await save("b", "2", ALICE, "output");
    const c = await save("c", "3", ALICE, "output");
    await save("d", "4", BOB, "output");

    expect((await listFiles(test.ctx, { ownerId: ALICE })).map((file) => file.name)).toEqual(["c", "b", "a"]);
    expect((await listFiles(test.ctx, { ownerId: ALICE, kind: "output" })).map((file) => file.id)).toEqual([c.id, b.id]);
    expect((await listFiles(test.ctx, { ownerId: ALICE, limit: 1, offset: 1 })).map((file) => file.id)).toEqual([b.id]);
    expect(await listFiles(test.ctx, { ownerId: "nobody" })).toEqual([]);
    await deleteFile(test.ctx, a.id);
    expect((await listFiles(test.ctx, { ownerId: ALICE })).map((file) => file.name)).toEqual(["c", "b"]);
  });

  it("clears a file's expiry so the prune keeps it, and sets one again so the prune takes it", async () => {
    const saved = await saveFile(test.ctx, { ownerId: ALICE, body: chunked("abc"), name: "clip.mov", ttlSeconds: 3600 });
    if (!saved.ok) throw new Error(`setup: ${saved.error}`);
    const file = saved.value;

    const kept = await setFileExpiry(test.ctx, file.id, { ownerId: ALICE, expiresAt: null });
    expect(kept).toEqual({ ok: true, value: { ...file, expiresAt: null } });
    test.clock.advance(2 * HOUR_MS);
    await pruneFiles(test.ctx);
    expect(await findFile(test.ctx, file.id)).toEqual({ ...file, expiresAt: null });

    const due = new Date(test.clock.now().getTime() + HOUR_MS);
    expect(await setFileExpiry(test.ctx, file.id, { expiresAt: due })).toEqual({ ok: true, value: { ...file, expiresAt: due } });
    test.clock.advance(HOUR_MS);
    expect(await findFile(test.ctx, file.id)).toBeNull();
    await pruneFiles(test.ctx);
    expect(await listRows(test.database)).toEqual([]);
    expect(test.storage.objects().size).toBe(0);
  });

  it("refuses an expiry for another owner's, a deleted, an expired or an unknown file", async () => {
    const file = await save("a.txt", "abc");
    const gone = await save("b.txt", "def");
    await deleteFile(test.ctx, gone.id);
    const brief = await saveFile(test.ctx, { ownerId: ALICE, body: chunked("ghi"), name: "c.txt", ttlSeconds: 1 });
    if (!brief.ok) throw new Error(`setup: ${brief.error}`);
    test.clock.advance(2000);
    const missing = { ok: false, error: "files.not_found" };

    expect(await setFileExpiry(test.ctx, file.id, { ownerId: BOB, expiresAt: null })).toEqual(missing);
    expect(await setFileExpiry(test.ctx, gone.id, { expiresAt: null })).toEqual(missing);
    expect(await setFileExpiry(test.ctx, brief.value.id, { expiresAt: null })).toEqual(missing);
    expect(await setFileExpiry(test.ctx, "not-a-uuid", { expiresAt: null })).toEqual(missing);
    expect(await setFileExpiry(test.ctx, "3f1c2b4a-5d6e-4f70-8192-a3b4c5d6e7f8", { expiresAt: null })).toEqual(missing);
    expect(await findFile(test.ctx, file.id)).toEqual(file);
  });

  it("deletes a file's bytes and row, once, and only for its owner when asked", async () => {
    const file = await save("a.txt", "abc");
    const other = await save("b.txt", "def");

    expect(await deleteFile(test.ctx, file.id, { ownerId: BOB })).toEqual({
      ok: false,
      error: "files.not_found",
    });
    expect(await deleteFile(test.ctx, file.id, { ownerId: ALICE })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await deleteFile(test.ctx, file.id)).toEqual({
      ok: false,
      error: "files.not_found",
    });
    expect(await deleteFile(test.ctx, "nope")).toEqual({
      ok: false,
      error: "files.not_found",
    });
    expect(await findFile(test.ctx, file.id)).toBeNull();
    expect(await listRows(test.database)).toEqual(["b.txt file 3"]);
    expect(test.storage.objects().size).toBe(1);
    expect(await findFile(test.ctx, other.id)).toEqual(other);
  });

  it("keeps a deleted file's row marked when storage fails, and hides the file at once", async () => {
    const file = await save("a.txt", "abc");
    test.storage.setFailing(true);

    expect(await deleteFile(test.ctx, file.id)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await findFile(test.ctx, file.id)).toBeNull();
    expect(await listRows(test.database)).toEqual(["a.txt file 3 deleted"]);
  });
});
