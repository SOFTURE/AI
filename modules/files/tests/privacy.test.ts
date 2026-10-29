// The privacy contributor and the health check.
import { files } from "@softure-ai/files";
import { checkFilesHealth, deleteFilesUserData, exportFilesUserData, saveFile } from "@softure-ai/files/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BOB, chunked, createTestFiles, listRows, type TestFiles } from "./support.js";

describe("files and privacy", () => {
  let test: TestFiles;

  beforeEach(async () => {
    test = await createTestFiles();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function save(ownerId: string, name: string): Promise<void> {
    const saved = await saveFile(test.ctx, {
      ownerId,
      body: chunked(name),
      name,
    });
    if (!saved.ok) throw new Error(`setup: ${saved.error}`);
    test.clock.advance(1000);
  }

  it("declares that it exports and deletes", () => {
    expect(files.manifest.privacy).toEqual({ exports: true, deletes: true });
  });

  it("exports the owner's live files without bytes or storage keys", async () => {
    await save(ALICE, "a.txt");
    await save(BOB, "b.txt");

    const exported = await exportFilesUserData(test.ctx, ALICE);

    expect(exported.value.files.map((file) => [file.name, file.ownerId, file.size])).toEqual([["a.txt", ALICE, 5]]);
    expect(JSON.stringify(exported)).not.toContain("storage");
    expect((await exportFilesUserData(test.ctx, "nobody")).value).toEqual({
      files: [],
    });
  });

  it("deletes every file of the owner from storage and the table, through the contributor too", async () => {
    await save(ALICE, "a.txt");
    await save(ALICE, "c.txt");
    await save(BOB, "b.txt");

    expect(await deleteFilesUserData(test.ctx, ALICE)).toEqual({
      ok: true,
      value: { deletedFiles: 2, pendingFiles: 0 },
    });
    expect(await listRows(test.database)).toEqual(["b.txt file 5"]);
    expect(test.storage.objects().size).toBe(1);
    const contributor = test.config.modules[0]?.privacy;
    expect(await contributor?.deleteUserData?.(test.ctx, BOB)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await listRows(test.database)).toEqual([]);
  });

  it("hides the owner's files at once when storage refuses, leaving the rest to the prune", async () => {
    await save(ALICE, "a.txt");
    test.storage.setFailing(true);

    expect(await deleteFilesUserData(test.ctx, ALICE)).toEqual({
      ok: true,
      value: { deletedFiles: 0, pendingFiles: 1 },
    });
    expect(await listRows(test.database)).toEqual(["a.txt file 5 deleted"]);
    expect((await exportFilesUserData(test.ctx, ALICE)).value).toEqual({
      files: [],
    });
  });
});

describe("the files health check", () => {
  let test: TestFiles;

  beforeEach(async () => {
    test = await createTestFiles({ files: { health: { minFreeBytes: 1000 } } });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("passes with the table in place and the storage writable with room", async () => {
    expect(await checkFilesHealth(test.ctx)).toEqual({
      ok: true,
      value: undefined,
    });
    test.storage.setCheck({ isWritable: true, freeBytes: null });
    expect(await checkFilesHealth(test.ctx)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("fails when the storage takes no write or runs low on space", async () => {
    test.storage.setCheck({ isWritable: false, freeBytes: 10_000 });
    expect(await checkFilesHealth(test.ctx)).toEqual({
      ok: false,
      error: "files.storage_unwritable",
    });
    test.storage.setCheck({ isWritable: true, freeBytes: 999 });
    expect(await checkFilesHealth(test.ctx)).toEqual({
      ok: false,
      error: "files.storage_low_space",
    });
  });

  it("throws when the table is missing (migrations not run)", async () => {
    await test.database.client.query("DROP TABLE files.files");
    await expect(checkFilesHealth(test.ctx)).rejects.toThrow();
  });
});
