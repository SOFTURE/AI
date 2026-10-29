// Retention: pruneFiles and the files.prune job remove expired and deleted files from storage and the table.
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { filesJobHandlers, filesJobSchedules } from "@softure-ai/files/jobs";
import { deleteFile, pruneFiles, saveFile } from "@softure-ai/files/server";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, chunked, closeTestFiles, createTestFiles, HOUR_MS, listRows, type TestFiles } from "./support.js";

describe("pruning files", () => {
  let test: TestFiles;

  async function save(name: string, ttlSeconds?: number): Promise<string> {
    const saved = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked(name),
      name,
      ttlSeconds,
    });
    if (!saved.ok) throw new Error(`setup: ${saved.error}`);
    return saved.value.id;
  }

  afterEach(closeTestFiles);

  it("removes expired files and finishes deletions storage refused, keeping the rest", async () => {
    test = await createTestFiles();
    await save("keep");
    await save("short", 60);
    await save("long", 7200);
    const failed = await save("failed");
    test.storage.setFailing(true);
    await deleteFile(test.ctx, failed);
    test.storage.setFailing(false);
    test.clock.advance(HOUR_MS);

    expect(await pruneFiles(test.ctx, { batchSize: 1 })).toEqual({
      deletedFiles: 2,
      freedBytes: 11,
      failedFiles: 0,
    });
    expect(await listRows(test.database)).toEqual(["keep file 4", "long file 4"]);
    expect(test.storage.objects().size).toBe(2);
    expect(await pruneFiles(test.ctx)).toEqual({
      deletedFiles: 0,
      freedBytes: 0,
      failedFiles: 0,
    });
  });

  it("keeps a file whose bytes storage refuses to delete for the next run", async () => {
    test = await createTestFiles();
    await save("a", 60);
    await save("b", 60);
    test.clock.advance(HOUR_MS);
    test.storage.setFailing(true);

    expect(await pruneFiles(test.ctx, { batchSize: 1 })).toEqual({
      deletedFiles: 0,
      freedBytes: 0,
      failedFiles: 2,
    });
    test.storage.setFailing(false);
    expect(await pruneFiles(test.ctx)).toEqual({
      deletedFiles: 2,
      freedBytes: 2,
      failedFiles: 0,
    });
  });

  it("schedules a handler for every queue it names", () => {
    expect(Object.keys(filesJobSchedules)).toEqual(Object.keys(filesJobHandlers));
    expect(jobsOptionsSchema.parse({ schedules: filesJobSchedules }).schedules).toEqual({ "files.prune": { every: "1h", payload: {} } });
  });

  it("prunes on its schedule", async () => {
    test = await createTestFiles({
      extraModules: [jobs({ schedules: filesJobSchedules })],
    });
    await save("short", 60);
    test.clock.advance(HOUR_MS);

    expect(await runDueJobs(test.ctx, { handlers: filesJobHandlers })).toEqual({
      succeeded: 1,
      retried: 0,
      failed: 0,
      stale: 0,
    });
    expect(await listRows(test.database)).toEqual([]);
  });
});
