// The jobs entry: the delivery handler run by the jobs runner against recording channels, its failure mapping, the
// flush schedule, and alertsFromJobs turning jobs events into alerts without alerting its own queues.
import { alertsFromJobs, alertsJobHandlers } from "@softure-ai/alerts/jobs";
import { alert, listRecentAlerts } from "@softure-ai/alerts/server";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import type { JobsLogger } from "@softure-ai/jobs/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestAlerts, failingWith, HOUR_MS, MINUTE_MS, NOW, recordingChannel, type TestAlerts } from "./support.js";

const silentLogger: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const INPUT = { key: "app.import", severity: "critical", title: "The import stopped", details: "Source x answered 500.", link: "https://app.example.com/admin" } as const;

let current: TestAlerts | undefined;

afterEach(async () => {
  await current?.database.close();
  current = undefined;
});

function run(test: TestAlerts) {
  return runDueJobs(test.ctx, { handlers: alertsJobHandlers, logger: silentLogger, random: () => 0 });
}

async function deliveryJobs(test: TestAlerts) {
  return (await listJobs(test.database.db)).filter((job) => job.queue === "alerts.deliver");
}

describe("the delivery job", () => {
  it("renders the message in the app's copy and hands it to the channel", async () => {
    const ops = recordingChannel();
    const test = (current = await createTestAlerts({ channels: { ops: ops.channel } }));
    await alert(test.ctx, INPUT);
    // The delivery, and the first run of the flush schedule.
    expect(await run(test)).toMatchObject({ succeeded: 2, failed: 0 });
    expect(ops.deliveries).toHaveLength(1);
    expect(ops.deliveries[0]?.subject).toBe("[Critical] The import stopped");
    expect(ops.deliveries[0]?.text).toBe("[Critical] The import stopped\nSource x answered 500.\nOpen: https://app.example.com/admin");
  });

  it("writes the repeat count and the recovery", async () => {
    const ops = recordingChannel();
    const test = (current = await createTestAlerts({ channels: { ops: ops.channel } }));
    await alert(test.ctx, INPUT);
    await alert(test.ctx, INPUT);
    test.clock.advance(HOUR_MS);
    await alert(test.ctx, INPUT);
    const { resolveAlert } = await import("@softure-ai/alerts/server");
    await alert(test.ctx, INPUT);
    await resolveAlert(test.ctx, INPUT.key);
    await run(test);
    expect(ops.deliveries.map((delivery) => delivery.subject)).toEqual([
      "[Critical] The import stopped",
      "[Critical, still happening] The import stopped",
      "[Resolved] The import stopped",
    ]);
    expect(ops.deliveries[1]?.text).toContain("Happened 2 more times since the last message.");
    expect(ops.deliveries[2]?.text).toContain("Happened 1 more time since the last message.");
  });

  it("keeps delivering to the other channels while one is down, and retries it", async () => {
    const ops = recordingChannel();
    const chat = recordingChannel();
    chat.respond = failingWith("alerts.channel_unavailable");
    const test = (current = await createTestAlerts({ channels: { ops: ops.channel, chat: chat.channel } }));
    await alert(test.ctx, INPUT);
    expect(await run(test)).toMatchObject({ succeeded: 2, retried: 1 });
    const [, retried] = await deliveryJobs(test);
    expect(retried).toMatchObject({ status: "pending", lastError: "alerts.channel_unavailable", runAt: new Date(NOW.getTime() + 30_000) });
    chat.respond = () => ({ ok: true, value: undefined });
    test.clock.advance(MINUTE_MS);
    expect(await run(test)).toMatchObject({ succeeded: 1 });
    expect(chat.deliveries).toHaveLength(2);
  });

  it("waits a rate limit's Retry-After", async () => {
    const ops = recordingChannel();
    ops.respond = failingWith("alerts.channel_rate_limited", 120);
    const test = (current = await createTestAlerts({ channels: { ops: ops.channel } }));
    await alert(test.ctx, INPUT);
    await run(test);
    const [job] = await deliveryJobs(test);
    expect(job).toMatchObject({ status: "pending", lastError: "alerts.channel_rate_limited", runAt: new Date(NOW.getTime() + 120_000) });
  });

  it.each(["alerts.channel_refused", "alerts.channel_unconfigured"] as const)("fails at once on %s", async (code) => {
    const ops = recordingChannel();
    ops.respond = failingWith(code);
    const test = (current = await createTestAlerts({ channels: { ops: ops.channel } }));
    await alert(test.ctx, INPUT);
    expect(await run(test)).toMatchObject({ failed: 1 });
    const [job] = await deliveryJobs(test);
    expect(job).toMatchObject({ status: "failed", lastError: code, attempts: 1 });
  });

  it("fails a delivery to a channel the config no longer has", async () => {
    const ops = recordingChannel();
    const test = (current = await createTestAlerts({ channels: { ops: ops.channel } }));
    const { enqueueJob } = await import("@softure-ai/jobs/server");
    const message = { kind: "fired", key: "k", severity: "info", title: "t", details: null, link: null, repeats: 0, occurrences: 1, at: NOW.toISOString() };
    await enqueueJob(test.ctx, { queue: "alerts.deliver", payload: { channel: "gone", message } });
    expect(await run(test)).toMatchObject({ failed: 1 });
    expect((await deliveryJobs(test))[0]).toMatchObject({ lastError: "alerts.unknown_channel" });
  });
});

describe("the flush schedule", () => {
  it("sends the summary of repeats left over once the window has passed", async () => {
    const ops = recordingChannel();
    const test = (current = await createTestAlerts({ channels: { ops: ops.channel } }));
    await alert(test.ctx, INPUT);
    await alert(test.ctx, INPUT);
    await run(test);
    test.clock.advance(HOUR_MS + 5 * MINUTE_MS);
    await run(test);
    expect(ops.deliveries.map((delivery) => delivery.message.kind)).toEqual(["fired", "repeated"]);
    expect(ops.deliveries[1]?.message.repeats).toBe(1);
  });
});

describe("alertsFromJobs", () => {
  const AT = NOW;

  it("alerts a failed job once per queue and counts the next ones", async () => {
    const test = (current = await createTestAlerts({ channels: { ops: recordingChannel().channel } }));
    const hooks = alertsFromJobs({ link: "https://app.example.com/admin/jobs" });
    await hooks.onJobFailed({ queue: "app.sync", jobId: "7", code: "app.timeout", attempts: 5, at: AT }, test.ctx);
    await hooks.onJobFailed({ queue: "app.sync", jobId: "8", code: "app.timeout", attempts: 5, at: AT }, test.ctx);
    const [record] = await listRecentAlerts(test.ctx);
    expect(record).toMatchObject({
      key: "jobs.failed:app.sync",
      severity: "warning",
      title: "A job failed on queue app.sync",
      details: "Job 8 ended failed after 5 attempts with app.timeout.",
      link: "https://app.example.com/admin/jobs",
      occurrences: 2,
    });
  });

  it("alerts a failing or late schedule and resolves it when healthy", async () => {
    const test = (current = await createTestAlerts({ channels: { ops: recordingChannel().channel } }));
    const hooks = alertsFromJobs();
    await hooks.onScheduleStateChanged({ queue: "app.sync", state: "failing", lastFailureCode: "app.timeout", at: AT }, test.ctx);
    expect((await listRecentAlerts(test.ctx))[0]).toMatchObject({ key: "jobs.schedule:app.sync", severity: "critical", title: "Schedule app.sync is failing", details: "Last failure: app.timeout.", status: "firing" });
    await hooks.onScheduleStateChanged({ queue: "app.sync", state: "late", lastFailureCode: null, at: AT }, test.ctx);
    expect((await listRecentAlerts(test.ctx))[0]).toMatchObject({ title: "Schedule app.sync is late", details: null });
    await hooks.onScheduleStateChanged({ queue: "app.sync", state: "healthy", lastFailureCode: null, at: AT }, test.ctx);
    expect((await listRecentAlerts(test.ctx))[0]).toMatchObject({ status: "resolved" });
  });

  it("alerts a paused queue, with or without an end", async () => {
    const test = (current = await createTestAlerts({ channels: { ops: recordingChannel().channel } }));
    const hooks = alertsFromJobs({ queuePausedSeverity: "critical" });
    await hooks.onQueuePaused({ queue: "app.sync", code: "app.captcha", until: new Date("2026-11-02T13:00:00Z") }, test.ctx);
    expect((await listRecentAlerts(test.ctx))[0]).toMatchObject({ key: "jobs.paused:app.sync", severity: "critical", details: "Paused with app.captcha until 2026-11-02T13:00:00.000Z." });
    await hooks.onQueuePaused({ queue: "app.other", code: "app.blocked", until: null }, test.ctx);
    expect((await listRecentAlerts(test.ctx)).find((record) => record.key === "jobs.paused:app.other")).toMatchObject({ details: "Paused with app.blocked until an operator resumes it." });
  });

  it("never alerts its own queues or the ignored ones", async () => {
    const test = (current = await createTestAlerts({ channels: { ops: recordingChannel().channel } }));
    const hooks = alertsFromJobs({ ignoreQueues: ["app.noise"] });
    for (const queue of ["alerts.deliver", "alerts.flush", "app.noise"]) {
      await hooks.onJobFailed({ queue, jobId: "1", code: "x", attempts: 1, at: AT }, test.ctx);
      await hooks.onScheduleStateChanged({ queue, state: "failing", lastFailureCode: "x", at: AT }, test.ctx);
      await hooks.onQueuePaused({ queue, code: "x", until: null }, test.ctx);
    }
    expect(await listRecentAlerts(test.ctx)).toEqual([]);
  });

  it("raises an alert when a delivery job of another queue fails through the real hook", async () => {
    const ops = recordingChannel();
    const test = (current = await createTestAlerts({ channels: { ops: ops.channel } }));
    // The same hook object jobs would call: wire it by hand, since the shared config has none.
    const hooks = alertsFromJobs();
    await hooks.onJobFailed({ queue: "app.sync", jobId: "1", code: "app.boom", attempts: 1, at: AT }, test.ctx);
    await run(test);
    expect(ops.deliveries.map((delivery) => delivery.subject)).toEqual(["[Warning] A job failed on queue app.sync"]);
  });

  it("logs and swallows a failure to record, so the job is never affected", async () => {
    const test = (current = await createTestAlerts({ channels: { ops: recordingChannel().channel } }));
    const hooks = alertsFromJobs();
    const broken = { ...test.ctx, db: { transaction: () => Promise.reject(new Error("db down")) } as never };
    const errors: string[] = [];
    const original = console.error;
    console.error = (line: string) => errors.push(line);
    try {
      await expect(hooks.onJobFailed({ queue: "app.sync", jobId: "1", code: "x", attempts: 1, at: AT }, broken)).resolves.toBeUndefined();
    } finally {
      console.error = original;
    }
    expect(errors).toEqual(["@softure-ai/alerts: the onJobFailed alert could not be recorded: Error"]);
  });
});
