// The panel's rows from the module's reads: every line in the app's copy, dates in its zone, no payload.
import { defineJobHandler, failJob, failSyncItem, jobsMessages } from "@softure-ai/jobs";
import { toJobsPanelData } from "@softure-ai/jobs/next";
import { enqueueJob, getQueueStats, listJobRuns, listRecentJobs, listSyncItems, pauseQueue, processSyncItem, requestJobCancel } from "@softure-ai/jobs/server";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { err, ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, SECOND_MS, type TestJobs } from "./support.js";

const en = jobsMessages.en;
const failing = { "mail.send": defineJobHandler({ payload: z.object({ to: z.string() }), run: () => Promise.resolve(err("app.bounced")) }) };

describe("toJobsPanelData", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs({
      schedules: { "reports.daily": { at: ["08:00", "17:30"], timeZone: "Europe/Warsaw" }, "reports.hourly": { every: "1h" } },
    });
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function read() {
    const [stats, jobs, syncItems] = await Promise.all([
      getQueueStats(test.ctx),
      listRecentJobs(test.ctx, { statuses: ["failed", "cancelled", "retrying"] }),
      listSyncItems(test.ctx),
    ]);
    return toJobsPanelData({ stats, jobs, syncItems }, en, test.ctx.config);
  }

  it("describes each queue: counts, backlog and, for a schedule, its period, runs and health", async () => {
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await runDueJobs(test.ctx, { handlers: { "reports.hourly": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) } });
    test.clock.advance(SECOND_MS);
    const { queues } = await read();

    expect(queues.find((queue) => queue.queue === "ai.reply")).toEqual({
      queue: "ai.reply",
      details: ["Pending 1 · running 0 · succeeded 0 · failed 0 · cancelled 0", "1 due, the oldest since Sep 15, 2026, 2:00 PM"],
      health: null,
      healthLabel: null,
      isScheduled: false,
      isPaused: false,
    });
    expect(queues.find((queue) => queue.queue === "reports.daily")).toEqual({
      queue: "reports.daily",
      details: [
        "Pending 0 · running 0 · succeeded 0 · failed 0 · cancelled 0",
        "Nothing due",
        "Runs at 08:00, 17:30, Europe/Warsaw",
        "No worker has run this schedule yet",
        "No run has succeeded yet",
      ],
      health: "late",
      healthLabel: "Late",
      isScheduled: true,
      isPaused: false,
    });
    expect(queues.find((queue) => queue.queue === "reports.hourly")?.details.slice(2)).toEqual(["Runs every 1h (UTC periods)", "Last success on Sep 15, 2026, 2:00 PM"]);
  });

  it("shows a queue's pause with its reason and end, an operator's pause until resumed, and the breaker's counter", async () => {
    await pauseQueue(test.ctx, "ai.reply", { reason: "app.rate_limited", until: new Date(test.clock.now().getTime() + 60 * SECOND_MS) });
    await pauseQueue(test.ctx, "mail.send", { reason: "jobs.operator_pause" });
    const { queues } = await read();
    expect(queues.find((queue) => queue.queue === "ai.reply")).toMatchObject({
      isPaused: true,
      details: expect.arrayContaining(["Paused by an operator until Sep 15, 2026, 2:01 PM (app.rate_limited)"]) as unknown,
    });
    expect(queues.find((queue) => queue.queue === "mail.send")).toMatchObject({
      isPaused: true,
      details: expect.arrayContaining(["Paused by an operator until resumed (jobs.operator_pause)"]) as unknown,
    });
  });

  it("counts the breaker's failures in a row", async () => {
    await test.database.close();
    test = await createTestJobs({ queues: { "ai.reply": { maxAttempts: 5, breaker: { failures: 5, pauseSeconds: 60 } } } });
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await runDueJobs(test.ctx, { handlers: { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(err("app.rate_limited")) }) }, random: () => 0 });
    const queue = (await read()).queues.find((candidate) => candidate.queue === "ai.reply");
    expect(queue).toMatchObject({ isPaused: false, details: expect.arrayContaining(["Failures in a row: 1"]) as unknown });
  });

  it("shows a failing schedule's last failure with its code", async () => {
    await runDueJobs(test.ctx, {
      handlers: { "reports.hourly": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(failJob("app.export_down")) }) },
      random: () => 0,
    });
    const hourly = (await read()).queues.find((queue) => queue.queue === "reports.hourly");
    expect(hourly?.health).toBe("failing");
    expect(hourly?.details).toContain("Last failure on Sep 15, 2026, 2:00 PM with app.export_down");
  });

  it("gives a job its code and attempts and never its payload", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: { to: "grace@example.com" } });
    await runDueJobs(test.ctx, { handlers: failing, random: () => 0 });
    const { jobs } = await read();
    expect(jobs).toEqual([
      {
        id,
        queue: "mail.send",
        heading: `mail.send · job ${id}`,
        status: "failed",
        statusLabel: "Failed",
        details: ["Attempts: 1 of 1", "Last error: app.bounced", "Changed on Sep 15, 2026, 2:00 PM"],
        canRetry: true,
        canCancel: false,
      },
    ]);
    expect(JSON.stringify(jobs)).not.toContain("grace@example.com");
  });

  it("shows a running job's progress with Cancel, and the request once made, without Cancel", async () => {
    const running = async () => {
      const jobs = await listRecentJobs(test.ctx, { statuses: ["running"] });
      return toJobsPanelData({ stats: [], jobs, syncItems: [] }, en, test.ctx.config).jobs;
    };
    const seen: Awaited<ReturnType<typeof running>>[] = [];
    const handlers = {
      "ai.reply": defineJobHandler({
        payload: z.object({}),
        run: async (_payload, { job, reportProgress }) => {
          await reportProgress({ step: "render.encode", done: 3, total: 10, code: "render.gpu" });
          seen.push(await running());
          await requestJobCancel(test.ctx, job.id);
          seen.push(await running());
          return ok();
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await runDueJobs(test.ctx, { handlers, random: () => 0 });

    const progress = ["Step: render.encode, 3 of 10", "State: render.gpu", "Progress reported on Sep 15, 2026, 2:00 PM"];
    expect(seen[0]).toEqual([
      {
        id,
        queue: "ai.reply",
        heading: `ai.reply · job ${id}`,
        status: "running",
        statusLabel: "Running",
        details: ["Attempts: 1 of 3", ...progress, "Changed on Sep 15, 2026, 2:00 PM"],
        canRetry: false,
        canCancel: true,
      },
    ]);
    expect(seen[1]?.[0]?.details).toEqual([
      "Attempts: 1 of 3",
      ...progress,
      "Cancel requested on Sep 15, 2026, 2:00 PM; the job stops at its next check",
      "Changed on Sep 15, 2026, 2:00 PM",
    ]);
    expect(seen[1]?.[0]?.canCancel).toBe(false);
  });

  it("leaves the runs out when the source has none, so an app's own composition is unchanged", async () => {
    expect(await read()).not.toHaveProperty("runs");
  });

  it("describes each run: origin, attempt, summary or error code, and never its payload", async () => {
    const done = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { to: "grace@example.com" }, origin: "webhook.stripe" });
    const summary = { code: "sync.imported", items: { new: 3, failed: 1 }, steps: { fetch: "done", notify: "skipped" } } as const;
    await runDueJobs(test.ctx, { handlers: { "ai.reply": defineJobHandler({ payload: z.unknown(), run: () => Promise.resolve(ok({ summary })) }) } });
    test.clock.advance(SECOND_MS);
    const bounced = await enqueueJob(test.ctx, { queue: "mail.send", payload: { to: "grace@example.com" } });
    await runDueJobs(test.ctx, { handlers: failing, random: () => 0 });
    const [stats, jobs, runs] = await Promise.all([getQueueStats(test.ctx), listRecentJobs(test.ctx, { statuses: ["failed"] }), listJobRuns(test.ctx)]);
    const data = toJobsPanelData({ stats, jobs, runs, syncItems: [] }, en, test.ctx.config);

    expect(data.runs?.map(({ heading, outcome, outcomeLabel, details }) => ({ heading, outcome, outcomeLabel, details }))).toEqual([
      {
        heading: `mail.send · job ${bounced.id}`,
        outcome: "failed",
        outcomeLabel: "Failed",
        details: ["Started by the app", "Attempt 1", "Error: app.bounced", "Finished on Sep 15, 2026, 2:00 PM"],
      },
      {
        heading: `ai.reply · job ${done.id}`,
        outcome: "succeeded",
        outcomeLabel: "Succeeded",
        details: [
          "Started by webhook.stripe",
          "Attempt 1",
          "Result: sync.imported",
          "Items: 3 new · 0 skipped · 1 failed",
          "Steps: fetch done, notify skipped",
          "Finished on Sep 15, 2026, 2:00 PM",
        ],
      },
    ]);
    expect(JSON.stringify(data.runs)).not.toContain("grace@example.com");
  });

  it("groups the ledger by source, with Retry item only for a failed item", async () => {
    await processSyncItem(test.ctx, { source: "gmail.inbox", itemId: "m-1" }, () => Promise.resolve(failSyncItem("app.unparseable")));
    test.clock.advance(SECOND_MS);
    await processSyncItem(test.ctx, { source: "todoist.tasks", itemId: "t-1" }, () => Promise.resolve(ok()));
    const { syncSources } = await read();
    expect(syncSources.map((source) => [source.heading, source.items.map((item) => [item.label, item.statusLabel, item.canRetry, item.details])])).toEqual([
      ["todoist.tasks", [["Item t-1", "Done", false, ["Attempts: 1", "Last seen on Sep 15, 2026, 2:00 PM"]]]],
      ["gmail.inbox", [["Item m-1", "Failed", true, ["Attempts: 1", "Code: app.unparseable", "Last seen on Sep 15, 2026, 2:00 PM"]]]],
    ]);
  });
});
