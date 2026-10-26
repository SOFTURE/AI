// Sync state of polling integrations: the cursor moves only by compare-and-set, the ledger runs an item's callback at
// most once to success, bounds its failed attempts and commits the caller's writes together with the outcome.
import { err, ok } from "@softure-ai/core";
import { failSyncItem, skipSyncItem, type SyncItemRunResult } from "@softure-ai/jobs";
import {
  advanceSyncCursor,
  getSyncCursor,
  listSyncItems,
  processSyncItem,
  pruneSyncItems,
  type JobsContext,
} from "@softure-ai/jobs/server";
import { listSyncState } from "@softure-ai/jobs/testing";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

const DAY_MS = 24 * 60 * 60 * SECOND_MS;
const SOURCE = "gmail.inbox";

describe("sync cursors", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("starts empty, is set from null and then moves only from the stored value", async () => {
    expect(await getSyncCursor(test.ctx, SOURCE)).toBeNull();
    expect(await advanceSyncCursor(test.ctx, { source: SOURCE, from: null, to: "100" })).toEqual(ok());
    expect(await getSyncCursor(test.ctx, SOURCE)).toBe("100");

    test.clock.advance(SECOND_MS);
    expect(await advanceSyncCursor(test.ctx, { source: SOURCE, from: "100", to: "250" })).toEqual(ok());
    expect(await getSyncCursor(test.ctx, SOURCE)).toBe("250");
    expect(await getSyncCursor(test.ctx, "todoist:project-42")).toBeNull();
  });

  it("refuses a move from a cursor that is no longer stored, so a slower worker cannot move it back", async () => {
    await advanceSyncCursor(test.ctx, { source: SOURCE, from: null, to: "100" });
    await advanceSyncCursor(test.ctx, { source: SOURCE, from: "100", to: "250" });

    expect(await advanceSyncCursor(test.ctx, { source: SOURCE, from: "100", to: "180" })).toEqual(err("jobs.sync_cursor_moved"));
    expect(await advanceSyncCursor(test.ctx, { source: SOURCE, from: null, to: "50" })).toEqual(err("jobs.sync_cursor_moved"));
    expect((await listSyncState(test.database.db)).cursors).toEqual({ [SOURCE]: "250" });
  });

  it("moves together with the caller's transaction and rolls back with it", async () => {
    await expect(
      test.database.db.transaction(async (tx) => {
        await advanceSyncCursor({ ...test.ctx, db: tx }, { source: SOURCE, from: null, to: "100" });
        throw new Error("batch failed");
      }),
    ).rejects.toThrow("batch failed");
    expect(await getSyncCursor(test.ctx, SOURCE)).toBeNull();
  });

  it("refuses an invalid source name or cursor", async () => {
    await expect(getSyncCursor(test.ctx, "Gmail")).rejects.toThrow('"Gmail" is not a sync source name');
    await expect(advanceSyncCursor(test.ctx, { source: SOURCE, from: null, to: "" })).rejects.toThrow("a sync cursor must have 1 to 2000 characters");
    await expect(advanceSyncCursor(test.ctx, { source: SOURCE, from: "", to: "1" })).rejects.toThrow("a sync cursor must have 1 to 2000 characters");
    await expect(advanceSyncCursor(test.ctx, { source: SOURCE, from: null, to: "x".repeat(2001) })).rejects.toThrow(RangeError);
  });
});

describe("processSyncItem", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
    await test.database.db.execute(sql`create table public.app_tasks (id text primary key)`);
  });
  afterEach(async () => {
    await test.database.close();
  });

  /** A callback that writes the app's own row through the item's transaction, then returns `result`. */
  function createTask(id: string, result: SyncItemRunResult = ok({ status: "done", resultRef: `task-${id}` })) {
    const attempts: number[] = [];
    const run = async (context: JobsContext & { attempt: number }): Promise<SyncItemRunResult> => {
      attempts.push(context.attempt);
      await context.db.execute(sql`insert into public.app_tasks (id) values (${id})`);
      return result;
    };
    return { run, attempts };
  }

  async function listTasks(): Promise<string[]> {
    const result = await test.database.db.execute<{ id: string }>(sql`select id from public.app_tasks order by id`);
    return result.rows.map((row) => row.id);
  }

  it("runs a new item once, commits its write with done, and skips it on every later run", async () => {
    const task = createTask("m1");
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, task.run)).toEqual({
      kind: "handled",
      item: {
        source: SOURCE,
        itemId: "m1",
        status: "done",
        errorCode: null,
        attempts: 1,
        resultRef: "task-m1",
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        updatedAt: NOW,
        finishedAt: NOW,
      },
    });

    test.clock.advance(SECOND_MS);
    const again = await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, task.run);
    expect(again).toMatchObject({ kind: "skipped", item: { status: "done", attempts: 1, updatedAt: NOW, lastSeenAt: new Date(NOW.getTime() + SECOND_MS) } });
    expect(task.attempts).toEqual([1]);
    expect(await listTasks()).toEqual(["m1"]);
  });

  it("treats a plain ok() as done without a reference", async () => {
    const outcome = await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, () => Promise.resolve(ok()));
    expect(outcome).toMatchObject({ kind: "handled", item: { status: "done", resultRef: null, errorCode: null } });
  });

  it("keeps the same item id of two sources apart", async () => {
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "1" }, () => Promise.resolve(ok()));
    const other = await processSyncItem(test.ctx, { source: "todoist:project-42", itemId: "1" }, () => Promise.resolve(ok()));
    expect(other.kind).toBe("handled");
  });

  it("rolls back the callback's write on a failure, counts the attempt and tries again next run", async () => {
    const failing = createTask("m1", err("app.provider_down"));
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 3 }, failing.run)).toMatchObject({
      kind: "retrying",
      error: "app.provider_down",
      item: { status: "pending", attempts: 1, errorCode: "app.provider_down", finishedAt: null },
    });
    expect(await listTasks()).toEqual([]);

    test.clock.advance(SECOND_MS);
    const passing = createTask("m1");
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 3 }, passing.run)).toMatchObject({
      kind: "handled",
      item: { status: "done", attempts: 2, errorCode: null, firstSeenAt: NOW },
    });
    expect(passing.attempts).toEqual([2]);
    expect(await listTasks()).toEqual(["m1"]);
  });

  it("fails an item for good after maxAttempts failed runs and never runs it again", async () => {
    const failing = createTask("m1", err("app.provider_down"));
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 2 }, failing.run);
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 2 }, failing.run)).toMatchObject({
      kind: "failed",
      error: "app.provider_down",
      item: { status: "failed", attempts: 2, errorCode: "app.provider_down", finishedAt: NOW },
    });
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 2 }, failing.run)).toMatchObject({
      kind: "skipped",
      item: { status: "failed", attempts: 2 },
    });
    expect(failing.attempts).toEqual([1, 2]);
  });

  it("fails at once with failSyncItem, whatever attempts are left", async () => {
    const outcome = await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 5 }, () => Promise.resolve(failSyncItem("app.not_supported")));
    expect(outcome).toMatchObject({ kind: "failed", error: "app.not_supported", item: { status: "failed", attempts: 1 } });
  });

  it("fails without running an item whose attempts a lowered maxAttempts already used up", async () => {
    const failing = createTask("m1", err("app.provider_down"));
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 5 }, failing.run);
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 5 }, failing.run);
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 2 }, failing.run)).toMatchObject({
      kind: "failed",
      error: "app.provider_down",
      item: { status: "failed", attempts: 2 },
    });
    expect(failing.attempts).toEqual([1, 2]);
  });

  it("skips an item the callback marks as not relevant, with its reason, and never runs it again", async () => {
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, () => Promise.resolve(skipSyncItem("app.not_a_task")))).toMatchObject({
      kind: "handled",
      item: { status: "skipped", errorCode: "app.not_a_task", attempts: 1, finishedAt: NOW },
    });
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m2" }, () => Promise.resolve(skipSyncItem()))).toMatchObject({
      kind: "handled",
      item: { status: "skipped", errorCode: null },
    });
    expect((await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, () => Promise.resolve(ok()))).kind).toBe("skipped");
  });

  it("records a throw as a failed attempt, rolls back the callback's write and rethrows", async () => {
    const run = async (context: JobsContext): Promise<SyncItemRunResult> => {
      await context.db.execute(sql`insert into public.app_tasks (id) values ('m1')`);
      throw new Error("bug in the app");
    };
    await expect(processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 1 }, run)).rejects.toThrow("bug in the app");
    expect(await listTasks()).toEqual([]);
    expect((await listSyncState(test.database.db)).items).toMatchObject([{ itemId: "m1", status: "failed", errorCode: "jobs.sync_item_threw", attempts: 1 }]);
  });

  it("counts a callback whose own query failed as a thrown attempt", async () => {
    const run = async (context: JobsContext): Promise<SyncItemRunResult> => {
      await context.db.execute(sql`insert into public.missing_table (id) values ('m1')`);
      return ok();
    };
    await expect(processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, run)).rejects.toThrow();
    expect((await listSyncState(test.database.db)).items).toMatchObject([{ itemId: "m1", status: "pending", errorCode: "jobs.sync_item_threw", attempts: 1 }]);
  });

  it("fails fast, as a thrown attempt, when the callback reads through the job's pool instead of its db (#785)", async () => {
    const run = async (): Promise<SyncItemRunResult> => {
      await test.ctx.db.execute(sql`select 1`); // the outer context: on the one-connection test database this would hang
      return ok();
    };
    const attempt = processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, run);
    await expect(attempt).rejects.toMatchObject({ cause: { name: "PoolInsideTransactionError" } });
    expect((await listSyncState(test.database.db)).items).toMatchObject([{ itemId: "m1", status: "pending", errorCode: "jobs.sync_item_threw", attempts: 1 }]);
  });

  it("counts an invalid result reference as a thrown attempt and rolls back the write", async () => {
    const task = createTask("m1", ok({ status: "done", resultRef: "" }));
    await expect(processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, task.run)).rejects.toThrow("a sync item resultRef must have 1 to 500 characters");
    expect(await listTasks()).toEqual([]);
    expect((await listSyncState(test.database.db)).items).toMatchObject([{ status: "pending", attempts: 1, errorCode: "jobs.sync_item_threw" }]);
  });

  it("treats a result that is neither ok nor an error as a thrown attempt, without throwing", async () => {
    const run = () => Promise.resolve(undefined as unknown as SyncItemRunResult);
    expect(await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, run)).toMatchObject({ kind: "retrying", error: "jobs.sync_item_threw" });
  });

  it("commits with the caller's own transaction when ctx.db is one", async () => {
    await expect(
      test.database.db.transaction(async (tx) => {
        await processSyncItem({ ...test.ctx, db: tx }, { source: SOURCE, itemId: "m1" }, createTask("m1").run);
        throw new Error("batch failed");
      }),
    ).rejects.toThrow("batch failed");
    expect(await listTasks()).toEqual([]);
    expect((await listSyncState(test.database.db)).items).toEqual([]);
  });

  it("refuses invalid input before touching the ledger", async () => {
    const run = () => Promise.resolve(ok());
    await expect(processSyncItem(test.ctx, { source: "Bad Source", itemId: "m1" }, run)).rejects.toThrow("is not a sync source name");
    await expect(processSyncItem(test.ctx, { source: SOURCE, itemId: "" }, run)).rejects.toThrow("a sync item id must have 1 to 500 characters");
    await expect(processSyncItem(test.ctx, { source: SOURCE, itemId: "x".repeat(501) }, run)).rejects.toThrow(RangeError);
    await expect(processSyncItem(test.ctx, { source: SOURCE, itemId: "m1", maxAttempts: 0 }, run)).rejects.toThrow("maxAttempts must be an integer from 1 to 1000");
    expect((await listSyncState(test.database.db)).items).toEqual([]);
  });
});

describe("listSyncItems and pruneSyncItems", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function seed(): Promise<void> {
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, () => Promise.resolve(ok()));
    test.clock.advance(SECOND_MS);
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "m2" }, () => Promise.resolve(err("app.provider_down")));
    test.clock.advance(SECOND_MS);
    await processSyncItem(test.ctx, { source: "todoist:project-42", itemId: "t1" }, () => Promise.resolve(failSyncItem("app.gone")));
  }

  it("lists the ledger most recently changed first, filtered by source, status and time", async () => {
    await seed();
    const ids = (items: { itemId: string }[]) => items.map((item) => item.itemId);

    expect(ids(await listSyncItems(test.ctx))).toEqual(["t1", "m2", "m1"]);
    expect(ids(await listSyncItems(test.ctx, { source: SOURCE }))).toEqual(["m2", "m1"]);
    expect(ids(await listSyncItems(test.ctx, { status: "failed" }))).toEqual(["t1"]);
    expect(ids(await listSyncItems(test.ctx, { source: SOURCE, status: "pending" }))).toEqual(["m2"]);
    expect(ids(await listSyncItems(test.ctx, { since: new Date(NOW.getTime() + SECOND_MS) }))).toEqual(["t1", "m2"]);
    expect(ids(await listSyncItems(test.ctx, { limit: 1 }))).toEqual(["t1"]);
    expect(await listSyncItems(test.ctx, { source: "unknown.source" })).toEqual([]);
  });

  it("refuses an invalid filter", async () => {
    await expect(listSyncItems(test.ctx, { limit: 0 })).rejects.toThrow("limit must be an integer from 1 to 1000");
    await expect(listSyncItems(test.ctx, { limit: 1001 })).rejects.toThrow(RangeError);
    await expect(listSyncItems(test.ctx, { source: "Bad" })).rejects.toThrow("is not a sync source name");
    await expect(listSyncItems(test.ctx, { since: new Date("nope") })).rejects.toThrow("since is an invalid date");
  });

  it("prunes items no run met within the retention, keeping one the source still returns", async () => {
    await seed();
    test.clock.advance(80 * DAY_MS);
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "m1" }, () => Promise.resolve(ok()));

    test.clock.advance(10 * DAY_MS - 2 * SECOND_MS);
    expect(await pruneSyncItems(test.ctx)).toBe(0);
    test.clock.advance(SECOND_MS + 1);
    expect(await pruneSyncItems(test.ctx)).toBe(1);
    test.clock.advance(SECOND_MS);
    expect(await pruneSyncItems(test.ctx)).toBe(1);
    expect((await listSyncState(test.database.db)).items.map((item) => item.itemId)).toEqual(["m1"]);
  });

  it("prunes by the configured retention", async () => {
    await test.database.close();
    test = await createTestJobs({ retention: { syncItemsDays: 1 } });
    await seed();
    test.clock.advance(DAY_MS);
    expect(await pruneSyncItems(test.ctx)).toBe(2);
  });
});
