// The module definition: its manifest, its options and the constraints of its table.
import { readFileSync } from "node:fs";
import { toModuleJson } from "@softure-ai/core";
import { jobs, jobsMessages, type DayOfMonth } from "@softure-ai/jobs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestJobs, NOW, type TestJobs } from "./support.js";

describe("the jobs module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(jobs));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(jobs.manifest.version).toBe(manifest.version);
  });

  it("ships English as its only built-in dictionary", () => {
    expect(Object.keys(jobsMessages)).toEqual(["en"]);
  });

  it("fills in the defaults of a queue and of the module", () => {
    const module = jobs({ queues: { "ai.reply": {} } });
    expect(module.options).toEqual({
      queues: { "ai.reply": { maxAttempts: 5, backoff: { baseSeconds: 10, maxSeconds: 3600 }, leaseSeconds: 300, concurrency: 1 } },
      schedules: {},
      pollIntervalMs: 1000,
      shutdownGraceMs: 20_000,
      retention: { succeededDays: 7, failedDays: 30, cancelledDays: 7, syncItemsDays: 90 },
      panelRole: "admin",
    });
  });

  it("refuses options it cannot run with, listing every problem", () => {
    expect(() =>
      // @ts-expect-error: the test passes values the types already forbid, as a JavaScript config could.
      jobs({ queues: { Reply: { maxAttempts: 0, backoff: { baseSeconds: 60, maxSeconds: 10 } } }, pollIntervalMs: 10, extra: true }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "jobs":',
        "- options.queues.Reply.maxAttempts: Too small: expected number to be >=1",
        "- options.queues.Reply.backoff.maxSeconds: maxSeconds must be at least baseSeconds",
        "- options.queues.Reply: is not a queue name: lowercase letters, digits, _ . and -, starting with a letter",
        "- options.pollIntervalMs: Too small: expected number to be >=50",
        '- options: Unrecognized key: "extra"',
      ].join("\n"),
    );
  });

  it("refuses options with neither a queue nor a schedule", () => {
    expect(() => jobs({ queues: {} })).toThrow("options.queues: must define at least one queue or schedule");
    expect(() => jobs({})).toThrow("options.queues: must define at least one queue or schedule");
  });

  it("gives a schedule's queue the default queue settings unless queues names it", () => {
    const module = jobs({
      queues: { "auth.prune-sessions": { maxAttempts: 2 } },
      schedules: { "auth.prune-sessions": { every: "1h" }, "security.prune-rate-limits": { every: "15m", payload: { all: true } } },
    });
    expect(module.options.queues).toEqual({
      "auth.prune-sessions": { maxAttempts: 2, backoff: { baseSeconds: 10, maxSeconds: 3600 }, leaseSeconds: 300, concurrency: 1 },
      "security.prune-rate-limits": { maxAttempts: 5, backoff: { baseSeconds: 10, maxSeconds: 3600 }, leaseSeconds: 300, concurrency: 1 },
    });
    expect(module.options.schedules).toEqual({
      "auth.prune-sessions": { every: "1h", payload: {} },
      "security.prune-rate-limits": { every: "15m", payload: { all: true } },
    });
  });

  it.each(["0m", "1s", "90", "1w", "8d", "169h", "01h", "1.5h", ""])("refuses the schedule period %j", (every) => {
    expect(() => jobs({ schedules: { "app.tick": { every } } })).toThrow(
      "- options.schedules.app.tick.every: must be a whole number of minutes, hours or days (e.g. 15m, 1h, 1d), from 1m to 7d",
    );
  });

  it("parses a local-time schedule, sorting its times", () => {
    const module = jobs({ schedules: { "billing.send-reminders": { at: ["21:00", "09:00"], timeZone: "Europe/Warsaw" } } });
    expect(module.options.schedules).toEqual({
      "billing.send-reminders": { at: ["09:00", "21:00"], timeZone: "Europe/Warsaw", payload: {} },
    });
  });

  it("parses calendar filters of a local-time schedule, sorting them", () => {
    const module = jobs({
      schedules: { "app.close-period": { at: ["23:00"], timeZone: "Europe/Warsaw", daysOfWeek: [5, 1, 3], daysOfMonth: ["last", 10, 1] } },
    });
    expect(module.options.schedules).toEqual({
      "app.close-period": { at: ["23:00"], timeZone: "Europe/Warsaw", daysOfWeek: [1, 3, 5], daysOfMonth: [1, 10, "last"], payload: {} },
    });
  });

  it.each([
    [{ daysOfWeek: [] }, "- options.schedules.app.tick.daysOfWeek: Too small"],
    [{ daysOfWeek: [0] }, "- options.schedules.app.tick.daysOfWeek.0: must be ISO days of the week (1 Monday to 7 Sunday), each once"],
    [{ daysOfWeek: [8] }, "- options.schedules.app.tick.daysOfWeek.0: must be ISO days of the week"],
    [{ daysOfWeek: [1.5] }, "- options.schedules.app.tick.daysOfWeek.0:"],
    [{ daysOfWeek: [1, 1] }, "- options.schedules.app.tick.daysOfWeek: must be ISO days of the week"],
    [{ daysOfMonth: [] }, "- options.schedules.app.tick.daysOfMonth: Too small"],
    [{ daysOfMonth: [0] }, '- options.schedules.app.tick.daysOfMonth.0: must be days of the month (1 to 31, or "last"), each once'],
    [{ daysOfMonth: [32] }, "- options.schedules.app.tick.daysOfMonth.0: must be days of the month"],
    // A value the type refuses too, as a config written in plain JavaScript could hold it.
    [{ daysOfMonth: ["first"] as unknown as DayOfMonth[] }, "- options.schedules.app.tick.daysOfMonth.0: must be days of the month"],
    [{ daysOfMonth: ["last", "last"] as DayOfMonth[] }, "- options.schedules.app.tick.daysOfMonth: must be days of the month"],
  ])("refuses the calendar filter %j", (filter, message) => {
    expect(() => jobs({ schedules: { "app.tick": { at: ["09:00"], timeZone: "UTC", ...filter } } })).toThrow(message);
  });

  it.each([
    [{ daysOfWeek: [1] }, "- options.schedules.app.tick.daysOfWeek: applies to at only; every has no local date"],
    [{ daysOfMonth: [1] }, "- options.schedules.app.tick.daysOfMonth: applies to at only; every has no local date"],
  ])("refuses the calendar filter %j on a period schedule", (filter, message) => {
    expect(() => jobs({ schedules: { "app.tick": { every: "1h", ...filter } } })).toThrow(message);
  });

  it.each([
    [{ at: ["09:00"] }, "- options.schedules.app.tick.timeZone: is required with at"],
    [{ at: ["09:00"], timeZone: "Mars/Olympus" }, "- options.schedules.app.tick.timeZone: is not a time zone the runtime knows"],
    [{ at: ["9:00"], timeZone: "UTC" }, "- options.schedules.app.tick.at.0: must be times of day as HH:MM (00:00 to 23:59), each once"],
    [{ at: ["24:00"], timeZone: "UTC" }, "- options.schedules.app.tick.at.0: must be times of day as HH:MM"],
    [{ at: ["09:00", "09:00"], timeZone: "UTC" }, "- options.schedules.app.tick.at: must be times of day as HH:MM"],
    [{ at: [], timeZone: "UTC" }, "- options.schedules.app.tick.at: Too small"],
    [{ every: "1h", at: ["09:00"], timeZone: "UTC" }, "- options.schedules.app.tick.every: set either every or at, not both"],
    [{}, "- options.schedules.app.tick.every: set either every or at, not both"],
    [{ every: "1d", timeZone: "UTC" }, "- options.schedules.app.tick.timeZone: applies to at only; every runs in UTC"],
  ])("refuses the local-time schedule %j", (schedule, message) => {
    expect(() => jobs({ schedules: { "app.tick": schedule } })).toThrow(message);
  });

  it("accepts schedule periods from one minute to seven days", () => {
    for (const every of ["1m", "15m", "1h", "24h", "1d", "7d", "168h", "10080m"]) {
      expect(() => jobs({ schedules: { "app.tick": { every } } })).not.toThrow();
    }
  });

  it("refuses a schedule whose name is not a queue name", () => {
    expect(() => jobs({ schedules: { Tick: { every: "1h" } } })).toThrow(
      "- options.schedules.Tick: is not a queue name: lowercase letters, digits, _ . and -, starting with a letter",
    );
  });
});

describe("jobs.jobs constraints", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function insertRow(overrides: Record<string, unknown> = {}): Promise<unknown> {
    const row = {
      queue: "ai.reply",
      payload: "{}",
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      locked_until: null,
      locked_by: null,
      claim_token: null,
      dedup_key: null,
      finished_at: null,
      ...overrides,
    };
    return test.database.client.query(
      `INSERT INTO jobs.jobs (queue, payload, status, attempts, max_attempts, run_at, locked_until, locked_by, claim_token,
         dedup_key, finished_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $6, $6)`,
      [row.queue, row.payload, row.status, row.attempts, row.max_attempts, NOW, row.locked_until, row.locked_by, row.claim_token, row.dedup_key, row.finished_at],
    );
  }

  const LOCK = { locked_until: NOW, locked_by: "worker", claim_token: "00000000-0000-4000-8000-000000000001" };

  it("accepts a pending, a running and a finished row", async () => {
    await expect(insertRow()).resolves.toBeDefined();
    await expect(insertRow({ status: "running", attempts: 1, ...LOCK })).resolves.toBeDefined();
    await expect(insertRow({ status: "succeeded", attempts: 1, finished_at: NOW })).resolves.toBeDefined();
  });

  it.each([
    ["an uppercase queue", { queue: "Reply" }],
    ["an unknown status", { status: "done" }],
    ["negative attempts", { attempts: -1 }],
    ["zero max attempts", { max_attempts: 0 }],
    ["a running row without a lease", { status: "running", attempts: 1 }],
    ["a running row before its first attempt", { status: "running", attempts: 0, ...LOCK }],
    ["a pending row with a lease", { ...LOCK }],
    ["a finished row without finished_at", { status: "failed", attempts: 1 }],
    ["a pending row with finished_at", { finished_at: NOW }],
    ["an empty dedup key", { dedup_key: "" }],
  ])("rejects %s", async (_case, overrides) => {
    await expect(insertRow(overrides)).rejects.toThrow(/check constraint/);
  });

  it("rejects a second live job with the same dedup key, and allows it once the first finished", async () => {
    await insertRow({ dedup_key: "message-1" });
    await expect(insertRow({ dedup_key: "message-1" })).rejects.toThrow(/duplicate key/);
    await insertRow({ dedup_key: "message-2", status: "succeeded", attempts: 1, finished_at: NOW });
    await expect(insertRow({ dedup_key: "message-2" })).resolves.toBeDefined();
    await expect(insertRow({ dedup_key: "message-1", queue: "mail.send" })).resolves.toBeDefined();
  });
});

describe("jobs.sync_items and jobs.sync_cursors constraints", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function insertItem(overrides: Record<string, unknown> = {}): Promise<unknown> {
    const row = {
      source: "gmail.inbox",
      item_id: "m1",
      status: "pending",
      error_code: null,
      attempts: 0,
      result_ref: null,
      last_seen_at: NOW,
      finished_at: null,
      ...overrides,
    };
    return test.database.client.query(
      `INSERT INTO jobs.sync_items (source, item_id, status, error_code, attempts, result_ref, first_seen_at, last_seen_at,
         updated_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $9)`,
      [row.source, row.item_id, row.status, row.error_code, row.attempts, row.result_ref, NOW, row.last_seen_at, row.finished_at],
    );
  }

  it("accepts a pending, a done, a skipped and a failed item", async () => {
    await expect(insertItem()).resolves.toBeDefined();
    await expect(insertItem({ item_id: "m2", status: "done", attempts: 1, result_ref: "task-1", finished_at: NOW })).resolves.toBeDefined();
    await expect(insertItem({ item_id: "m3", status: "skipped", attempts: 1, finished_at: NOW })).resolves.toBeDefined();
    await expect(insertItem({ item_id: "m4", status: "failed", attempts: 2, error_code: "app.down", finished_at: NOW })).resolves.toBeDefined();
  });

  it.each([
    ["an uppercase source", { source: "Gmail" }],
    ["an unknown status", { status: "succeeded", finished_at: NOW }],
    ["an empty item id", { item_id: "" }],
    ["negative attempts", { attempts: -1 }],
    ["a finished item without finished_at", { status: "done", attempts: 1 }],
    ["a pending item with finished_at", { finished_at: NOW }],
    ["a failed item without an error code", { status: "failed", attempts: 1, finished_at: NOW }],
    ["a done item never run", { status: "done", finished_at: NOW }],
    ["a result reference on a pending item", { result_ref: "task-1" }],
    ["a last sighting before the first", { last_seen_at: new Date(NOW.getTime() - 1) }],
  ])("rejects %s", async (_case, overrides) => {
    await expect(insertItem(overrides)).rejects.toThrow(/check constraint/);
  });

  it("keeps one row per source and item, and one cursor per source", async () => {
    await insertItem();
    await expect(insertItem()).rejects.toThrow(/duplicate key/);
    await expect(insertItem({ source: "todoist:project-42" })).resolves.toBeDefined();
    const insertCursor = (cursor: string) =>
      test.database.client.query("INSERT INTO jobs.sync_cursors (source, cursor, created_at, updated_at) VALUES ($1, $2, $3, $3)", ["gmail.inbox", cursor, NOW]);
    await expect(insertCursor("")).rejects.toThrow(/check constraint/);
    await insertCursor("100");
    await expect(insertCursor("200")).rejects.toThrow(/duplicate key/);
  });
});
