// The Next adapter with Next's request scope replaced: `revalidatePath` is recorded, `notFound` throws, the app's
// guard is a stub that lets the test decide who holds the panel role, and the config hands the test PGlite to the
// adapter through `database.handle`, so the real steering functions and the real page reads run.
import { defineSoftureConfig, err, ok, type SoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeConfiguredDatabases, createPgliteHandle } from "@softure-ai/db";
import { defineJobHandler, failSyncItem, jobs, type JobsFormState, type JobsOptionsInput, type JobsPanelGuard } from "@softure-ai/jobs";
import { cancelJobAction, JobsPage, readSyncFilter, retryJobAction, retrySyncItemAction, runScheduleNowAction } from "@softure-ai/jobs/next";
import { enqueueJob, processSyncItem } from "@softure-ai/jobs/server";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, QUEUES, type TestJobs } from "./support.js";

const scope = vi.hoisted(() => ({ isAdmin: true, revalidated: [] as string[], checkedRoles: [] as string[] }));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    scope.revalidated.push(path);
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("test: notFound");
  },
}));

const guard: JobsPanelGuard = {
  requireRole: (role) => {
    scope.checkedRoles.push(role);
    if (!scope.isAdmin) throw new Error("test: notFound");
    return Promise.resolve({ id: "admin-1" });
  },
  authorizeRole: (role) => {
    scope.checkedRoles.push(role);
    return Promise.resolve(scope.isAdmin ? ok({ id: "admin-1" }) : err("auth.forbidden"));
  },
};

const IDLE: JobsFormState = { status: "idle" };
const SCHEDULES = { "reports.daily": { every: "1d", payload: { kind: "daily" } } } satisfies JobsOptionsInput["schedules"];
const failing = { "mail.send": defineJobHandler({ payload: z.object({ to: z.string() }), run: () => Promise.resolve(err("app.bounced")) }) };

function createForm(fields: Readonly<Record<string, string>>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

describe("the Next adapter", () => {
  let test: TestJobs;

  async function start(options: Partial<JobsOptionsInput> = { schedules: SCHEDULES, panelGuard: guard }): Promise<SoftureConfig> {
    test = await createTestJobs(options);
    const client = test.database.client;
    const config = defineSoftureConfig({ ...test.ctx.config, database: { url: "pglite://", handle: () => createPgliteHandle(client) } });
    registerSoftureConfig(config);
    return config;
  }

  async function failMail(): Promise<string> {
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: { to: "grace@example.com" } });
    await runDueJobs(test.ctx, { handlers: failing, random: () => 0 });
    return id;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    scope.isAdmin = true;
  });
  afterEach(async () => {
    scope.revalidated.length = 0;
    scope.checkedRoles.length = 0;
    vi.useRealTimers();
    clearSoftureConfig();
    // The configured handle wraps the test PGlite, so closing it closes the test database too.
    await closeConfiguredDatabases();
  });

  it("runs a schedule now, then joins the pending run, and revalidates the page", async () => {
    await start();
    expect(await runScheduleNowAction(IDLE, createForm({ queue: "reports.daily" }))).toEqual({ status: "ok", notice: "run_enqueued" });
    expect(await runScheduleNowAction(IDLE, createForm({ queue: "reports.daily" }))).toEqual({ status: "ok", notice: "run_joined" });
    expect((await listJobs(test.database.db)).map((job) => [job.queue, job.status])).toEqual([["reports.daily", "pending"]]);
    expect(scope.revalidated).toEqual(["/admin/jobs", "/admin/jobs"]);
    expect(await runScheduleNowAction(IDLE, createForm({ queue: "ai.reply" }))).toEqual({ status: "error", error: "jobs.not_a_schedule" });
    expect(await runScheduleNowAction(IDLE, new FormData())).toEqual({ status: "error", error: "jobs.not_a_schedule" });
    expect(scope.revalidated).toHaveLength(2);
  });

  it("retries a failed job and cancels a pending one", async () => {
    await start();
    const failed = await failMail();
    expect(await retryJobAction(IDLE, createForm({ id: failed }))).toEqual({ status: "ok" });
    expect(await cancelJobAction(IDLE, createForm({ id: failed }))).toEqual({ status: "ok" });
    expect(await retryJobAction(IDLE, createForm({ id: "not-an-id" }))).toEqual({ status: "error", error: "jobs.not_found" });
    expect(await cancelJobAction(IDLE, createForm({ id: failed }))).toEqual({ status: "error", error: "jobs.not_cancellable" });
    expect((await listJobs(test.database.db)).map((job) => job.status)).toEqual(["cancelled"]);
  });

  it("puts a failed sync item back to pending", async () => {
    await start();
    await processSyncItem(test.ctx, { source: "gmail.inbox", itemId: "m-1" }, () => Promise.resolve(failSyncItem("app.unparseable")));
    expect(await retrySyncItemAction(IDLE, createForm({ source: "gmail.inbox", itemId: "m-1" }))).toEqual({ status: "ok" });
    expect(await retrySyncItemAction(IDLE, createForm({ source: "gmail.inbox", itemId: "m-1" }))).toEqual({ status: "error", error: "jobs.sync_item_not_retryable" });
    expect(await retrySyncItemAction(IDLE, createForm({}))).toEqual({ status: "error", error: "jobs.sync_item_not_found" });
  });

  it("refuses every action to a caller without the panel role, before touching anything", async () => {
    await start({ schedules: SCHEDULES, panelGuard: guard, panelRole: "operator" });
    const failed = await failMail();
    scope.isAdmin = false;
    const forbidden = { status: "error", error: "auth.forbidden" };
    expect(await runScheduleNowAction(IDLE, createForm({ queue: "reports.daily" }))).toEqual(forbidden);
    expect(await retryJobAction(IDLE, createForm({ id: failed }))).toEqual(forbidden);
    expect(await cancelJobAction(IDLE, createForm({ id: failed }))).toEqual(forbidden);
    expect(await retrySyncItemAction(IDLE, createForm({ source: "gmail.inbox", itemId: "m-1" }))).toEqual(forbidden);
    expect(scope.checkedRoles).toEqual(["operator", "operator", "operator", "operator"]);
    expect((await listJobs(test.database.db)).map((job) => job.status)).toEqual(["failed"]);
    expect(scope.revalidated).toEqual([]);
  });

  it("refuses every action and hides the page while the app passes no guard", async () => {
    await start({ schedules: SCHEDULES });
    expect(await runScheduleNowAction(IDLE, createForm({ queue: "reports.daily" }))).toEqual({ status: "error", error: "auth.forbidden" });
    await expect(JobsPage()).rejects.toThrow("test: notFound");
    expect(await listJobs(test.database.db)).toEqual([]);
  });

  it("turns a database failure into a safe code", async () => {
    await start();
    await test.database.client.exec("DROP TABLE jobs.jobs CASCADE");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await retryJobAction(IDLE, createForm({ id: "1" }))).toEqual({ status: "error", error: "core.database_failed" });
    expect(error.mock.calls.map(([line]) => String(line))).toEqual([expect.stringContaining("@softure-ai/jobs: retrying a job failed:") as string]);
    error.mockRestore();
  });

  it("revalidates the page route the app configured", async () => {
    test = await createTestJobs();
    const client = test.database.client;
    registerSoftureConfig(
      defineSoftureConfig({
        ...test.ctx.config,
        database: { url: "pglite://", handle: () => createPgliteHandle(client) },
        modules: [jobs({ queues: QUEUES, schedules: SCHEDULES, panelGuard: guard, routes: { panel: "/ops/jobs" } })],
      }),
    );
    await runScheduleNowAction(IDLE, createForm({ queue: "reports.daily" }));
    expect(scope.revalidated).toEqual(["/ops/jobs"]);
  });

  it("renders the page for the panel role, with codes but no payload", async () => {
    await start();
    await failMail();
    await processSyncItem(test.ctx, { source: "gmail.inbox", itemId: "m-1" }, () => Promise.resolve(failSyncItem("app.unparseable")));
    const html = renderToStaticMarkup(await JobsPage({ searchParams: Promise.resolve({ sync: "failed" }) }));
    expect(scope.checkedRoles).toEqual(["admin"]);
    expect(html).toContain("Background jobs");
    expect(html).toContain("reports.daily");
    expect(html).toContain("Last error: app.bounced");
    expect(html).toContain("Item m-1");
    expect(html).toContain("Code: app.unparseable");
    expect(html).toContain('href="/admin/jobs?sync=failed" class="sft:text-accent sft:underline" aria-current="page"');
    expect(html).not.toContain("grace@example.com");
  });

  it("is not found for a caller without the panel role", async () => {
    await start();
    scope.isAdmin = false;
    await expect(JobsPage()).rejects.toThrow("test: notFound");
  });

  it("reads the ledger filter from the query, ignoring a value that is not a status", () => {
    expect(readSyncFilter({ sync: "failed" })).toBe("failed");
    expect(readSyncFilter({ sync: ["done", "failed"] })).toBe("done");
    expect(readSyncFilter({ sync: "everything" })).toBeNull();
    expect(readSyncFilter(undefined)).toBeNull();
  });
});
