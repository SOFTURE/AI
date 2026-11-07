// Retention: pruneFiles and the files.prune job remove expired and deleted files from storage and the table.
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { createFilesJobHandlers, filesJobHandlers, filesJobSchedules, type FilesJobsLogFields } from "@softure-ai/files/jobs";
import { deleteFile, pruneFiles, saveFile } from "@softure-ai/files/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    const short = await save("short", 60);
    await save("long", 7200);
    const failed = await save("failed");
    test.storage.setFailing(true);
    await deleteFile(test.ctx, failed);
    test.storage.setFailing(false);
    test.clock.advance(HOUR_MS);

    expect(await pruneFiles(test.ctx, { batchSize: 1 })).toEqual({
      deletedFiles: 2,
      freedBytes: 11,
      // The clock stands still, so the files come out in id order (created at, then id).
      removedFileIds: [short, failed].sort(),
      failedFiles: 0,
      deletedUploads: 0,
      failedUploads: 0,
    });
    expect(await listRows(test.database)).toEqual(["keep file 4", "long file 4"]);
    expect(test.storage.objects().size).toBe(2);
    expect(await pruneFiles(test.ctx)).toEqual({
      deletedFiles: 0,
      freedBytes: 0,
      removedFileIds: [],
      failedFiles: 0,
      deletedUploads: 0,
      failedUploads: 0,
    });
  });

  it("keeps a file whose bytes storage refuses to delete for the next run", async () => {
    test = await createTestFiles();
    const a = await save("a", 60);
    const b = await save("b", 60);
    test.clock.advance(HOUR_MS);
    test.storage.setFailing(true);

    expect(await pruneFiles(test.ctx, { batchSize: 1 })).toEqual({
      deletedFiles: 0,
      freedBytes: 0,
      removedFileIds: [],
      failedFiles: 2,
      deletedUploads: 0,
      failedUploads: 0,
    });
    test.storage.setFailing(false);
    expect(await pruneFiles(test.ctx)).toEqual({
      deletedFiles: 2,
      freedBytes: 2,
      removedFileIds: [a, b].sort(),
      failedFiles: 0,
      deletedUploads: 0,
      failedUploads: 0,
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

  describe("the files.prune job log", () => {
    async function runPruneJob(): Promise<FilesJobsLogFields[]> {
      const lines: FilesJobsLogFields[] = [];
      const handlers = createFilesJobHandlers({
        logger: {
          info: (message, fields) => {
            expect(message).toBe("files.prune finished");
            lines.push(fields ?? {});
          },
        },
      });
      expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
      return lines;
    }

    it("logs the count, the freed bytes and the id of one removed file", async () => {
      test = await createTestFiles({ extraModules: [jobs({ schedules: filesJobSchedules })] });
      const id = await save("short", 60);
      test.clock.advance(HOUR_MS);

      expect(await runPruneJob()).toEqual([
        { removed: 1, freedBytes: 5, failedFiles: 0, deletedUploads: 0, failedUploads: 0, fileIds: [id] },
      ]);
    });

    it("logs removed=0 when nothing expired", async () => {
      test = await createTestFiles({ extraModules: [jobs({ schedules: filesJobSchedules })] });
      await save("keep");
      test.clock.advance(HOUR_MS);

      expect(await runPruneJob()).toEqual([
        { removed: 0, freedBytes: 0, failedFiles: 0, deletedUploads: 0, failedUploads: 0, fileIds: [] },
      ]);
    });

    it("logs only the count when more than 10 files went", async () => {
      test = await createTestFiles({ extraModules: [jobs({ schedules: filesJobSchedules })] });
      for (let index = 0; index < 11; index += 1) await save(`f${String(index).padStart(2, "0")}`, 60);
      test.clock.advance(HOUR_MS);

      expect(await runPruneJob()).toEqual([
        { removed: 11, freedBytes: 33, failedFiles: 0, deletedUploads: 0, failedUploads: 0 },
      ]);
    });

    it("keeps at most 10 ids in the report of a large run", async () => {
      test = await createTestFiles();
      const saved: string[] = [];
      for (let index = 0; index < 11; index += 1) saved.push(await save(`f${String(index).padStart(2, "0")}`, 60));
      test.clock.advance(HOUR_MS);

      const report = await pruneFiles(test.ctx, { batchSize: 4 });
      expect(report.deletedFiles).toBe(11);
      expect(report.removedFileIds).toHaveLength(10);
      expect(new Set(report.removedFileIds).size).toBe(10);
      expect(saved).toEqual(expect.arrayContaining([...report.removedFileIds]));
    });

    it("writes one key=value line to the console without a logger", async () => {
      test = await createTestFiles({ extraModules: [jobs({ schedules: filesJobSchedules })] });
      const id = await save("short", 60);
      test.clock.advance(HOUR_MS);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      try {
        expect(await runDueJobs(test.ctx, { handlers: filesJobHandlers })).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
        expect(log.mock.calls.filter(([line]) => String(line).startsWith("@softure-ai/files:"))).toEqual([
          [`@softure-ai/files: files.prune finished removed=1 freedBytes=5 failedFiles=0 deletedUploads=0 failedUploads=0 fileIds=${id}`],
        ]);
      } finally {
        log.mockRestore();
      }
    });
  });
});
