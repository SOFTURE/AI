// The panel's rows from the module's reads: every line in the app's copy, dates in its zone, no payload.
import { defineJobHandler, failJob, failSyncItem, jobsMessages } from "@softure-ai/jobs";
import { toJobsPanelData } from "@softure-ai/jobs/next";
import { enqueueJob, getQueueStats, listRecentJobs, listSyncItems, processSyncItem } from "@softure-ai/jobs/server";
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
    });
    expect(queues.find((queue) => queue.queue === "reports.hourly")?.details.slice(2)).toEqual(["Runs every 1h (UTC periods)", "Last success on Sep 15, 2026, 2:00 PM"]);
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
