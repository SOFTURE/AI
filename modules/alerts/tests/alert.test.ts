// alert / resolveAlert / flushAlertRepeats: what fires, what is counted, what is summarized, and which delivery jobs
// each decision writes.
import { alertsTable, type AlertMessage } from "@softure-ai/alerts";
import { alert, flushAlertRepeats, listRecentAlerts, resolveAlert, type DeliveryPayload } from "@softure-ai/alerts/server";
import { listJobs } from "@softure-ai/jobs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { createTestAlerts, HOUR_MS, MINUTE_MS, NOW, recordingChannel, type TestAlerts } from "./support.js";

let current: TestAlerts | undefined;

afterEach(async () => {
  await current?.database.close();
  current = undefined;
});

async function setup(options: Parameters<typeof createTestAlerts>[0] = { channels: { ops: recordingChannel().channel } }): Promise<TestAlerts> {
  current = await createTestAlerts(options);
  return current;
}

async function listDeliveries(test: TestAlerts): Promise<(DeliveryPayload & { readonly runAt: Date })[]> {
  const rows = await listJobs(test.database.db);
  return rows.filter((job) => job.queue === "alerts.deliver").map((job) => ({ ...(job.payload as DeliveryPayload), runAt: job.runAt }));
}

const INPUT = { key: "jobs.failed:ai.reply", severity: "warning", title: "A job failed on queue ai.reply" } as const;

function expectMessage(message: AlertMessage, expected: Partial<AlertMessage>): void {
  expect(message).toMatchObject(expected);
}

describe("alert", () => {
  it("fires a new key once per channel", async () => {
    const test = await setup({ channels: { ops: recordingChannel().channel, chat: recordingChannel().channel } });
    const result = await alert(test.ctx, { ...INPUT, details: "Job 7 failed.", link: "https://app.example.com/admin/jobs" });
    expect(result).toEqual({ ok: true, value: "fired" });
    const deliveries = await listDeliveries(test);
    expect(deliveries.map((delivery) => delivery.channel)).toEqual(["ops", "chat"]);
    expect(deliveries[0]?.message).toEqual({
      kind: "fired",
      key: INPUT.key,
      severity: "warning",
      title: INPUT.title,
      details: "Job 7 failed.",
      link: "https://app.example.com/admin/jobs",
      repeats: 0,
      occurrences: 1,
      at: NOW.toISOString(),
    });
    expect(deliveries[0]?.runAt).toEqual(NOW);
  });

  it("counts repeats inside the window without sending", async () => {
    const test = await setup();
    await alert(test.ctx, INPUT);
    test.clock.advance(10 * MINUTE_MS);
    expect(await alert(test.ctx, INPUT)).toEqual({ ok: true, value: "counted" });
    expect(await alert(test.ctx, INPUT)).toEqual({ ok: true, value: "counted" });
    expect(await listDeliveries(test)).toHaveLength(1);
    const [record] = await listRecentAlerts(test.ctx);
    expect(record).toMatchObject({ status: "firing", occurrences: 3, pendingRepeats: 2, lastNotifiedAt: NOW });
  });

  it("sends a summary with the count on the first occurrence after the window", async () => {
    const test = await setup();
    await alert(test.ctx, INPUT);
    test.clock.advance(10 * MINUTE_MS);
    await alert(test.ctx, INPUT);
    await alert(test.ctx, INPUT);
    test.clock.advance(HOUR_MS);
    expect(await alert(test.ctx, INPUT)).toEqual({ ok: true, value: "repeated" });
    const deliveries = await listDeliveries(test);
    expect(deliveries).toHaveLength(2);
    expectMessage(deliveries[1]!.message, { kind: "repeated", repeats: 3, occurrences: 4 });
    const [record] = await listRecentAlerts(test.ctx);
    expect(record).toMatchObject({ occurrences: 4, pendingRepeats: 0 });
  });

  it("sends at once when the severity rises inside the window", async () => {
    const test = await setup();
    await alert(test.ctx, INPUT);
    expect(await alert(test.ctx, { ...INPUT, severity: "critical" })).toEqual({ ok: true, value: "repeated" });
    expectMessage((await listDeliveries(test))[1]!.message, { kind: "repeated", severity: "critical", repeats: 1 });
  });

  it("keeps the highest severity while firing, so a flapping severity sends once", async () => {
    const test = await setup();
    await alert(test.ctx, INPUT);
    await alert(test.ctx, { ...INPUT, severity: "critical" });
    expect(await alert(test.ctx, INPUT)).toEqual({ ok: true, value: "counted" });
    expect(await alert(test.ctx, { ...INPUT, severity: "critical" })).toEqual({ ok: true, value: "counted" });
    expect(await listDeliveries(test)).toHaveLength(2);
    expect((await listRecentAlerts(test.ctx))[0]?.severity).toBe("critical");
  });

  it("skips channels whose minimum severity the alert does not reach", async () => {
    const test = await setup({ channels: { ops: recordingChannel().channel, pager: recordingChannel({ minSeverity: "critical" }).channel } });
    await alert(test.ctx, INPUT);
    await alert(test.ctx, { ...INPUT, key: "health:database", severity: "critical" });
    expect((await listDeliveries(test)).map((delivery) => delivery.channel)).toEqual(["ops", "ops", "pager"]);
  });

  it("holds messages below the exempt severities until quiet hours end", async () => {
    const quietHours = { from: "22:00", to: "07:00", timeZone: "Europe/Warsaw" };
    const test = await setup({ channels: { ops: recordingChannel({ quietHours }).channel } });
    // 23:30 in Warsaw (UTC+1 in November).
    test.clock.set(new Date("2026-11-02T22:30:00Z"));
    await alert(test.ctx, INPUT);
    await alert(test.ctx, { ...INPUT, key: "health:database", severity: "critical" });
    const [held, urgent] = await listDeliveries(test);
    expect(held?.runAt).toEqual(new Date("2026-11-03T06:00:00Z"));
    expect(urgent?.runAt).toEqual(new Date("2026-11-02T22:30:00Z"));
  });

  it("refuses an invalid key, title, details or link and records nothing", async () => {
    const test = await setup();
    for (const input of [
      { ...INPUT, key: "has space" },
      { ...INPUT, key: "" },
      { ...INPUT, title: "" },
      { ...INPUT, title: "two\nlines" },
      { ...INPUT, title: "x".repeat(201) },
      { ...INPUT, details: "x".repeat(4001) },
      { ...INPUT, link: "javascript:alert(1)" },
    ]) {
      expect(await alert(test.ctx, input)).toEqual({ ok: false, error: "alerts.invalid_input" });
    }
    expect(await listRecentAlerts(test.ctx)).toEqual([]);
    expect(await listDeliveries(test)).toEqual([]);
  });

  it("leaves nothing behind when the caller's transaction rolls back", async () => {
    const test = await setup();
    const rollback = new Error("rollback");
    await expect(
      test.ctx.db.transaction(async (tx) => {
        await alert({ ...test.ctx, db: tx }, INPUT);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await listRecentAlerts(test.ctx)).toEqual([]);
    expect(await listDeliveries(test)).toEqual([]);
  });

  it("counts every occurrence of calls that run at once", async () => {
    const test = await setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => alert(test.ctx, INPUT)));
    expect(results.map((result) => result.ok && result.value).sort()).toEqual(["counted", "counted", "counted", "counted", "fired"]);
    const [record] = await listRecentAlerts(test.ctx);
    expect(record).toMatchObject({ occurrences: 5, pendingRepeats: 4 });
    expect(await listDeliveries(test)).toHaveLength(1);
  });
});

describe("resolveAlert", () => {
  it("sends a recovery with the repeats not reported yet", async () => {
    const test = await setup();
    await alert(test.ctx, INPUT);
    await alert(test.ctx, INPUT);
    test.clock.advance(MINUTE_MS);
    expect(await resolveAlert(test.ctx, INPUT.key)).toBe(true);
    const deliveries = await listDeliveries(test);
    expectMessage(deliveries[1]!.message, { kind: "resolved", repeats: 1, occurrences: 2 });
    const [record] = await listRecentAlerts(test.ctx);
    expect(record).toMatchObject({ status: "resolved", pendingRepeats: 0, resolvedAt: new Date(NOW.getTime() + MINUTE_MS) });
  });

  it("does nothing for a key that is not firing", async () => {
    const test = await setup();
    expect(await resolveAlert(test.ctx, "unknown")).toBe(false);
    await alert(test.ctx, INPUT);
    expect(await resolveAlert(test.ctx, INPUT.key)).toBe(true);
    expect(await resolveAlert(test.ctx, INPUT.key)).toBe(false);
    expect(await listDeliveries(test)).toHaveLength(2);
  });

  it("fires again when a resolved key comes back, counting from one", async () => {
    const test = await setup();
    await alert(test.ctx, INPUT);
    await alert(test.ctx, INPUT);
    await resolveAlert(test.ctx, INPUT.key);
    test.clock.advance(MINUTE_MS);
    expect(await alert(test.ctx, INPUT)).toEqual({ ok: true, value: "fired" });
    const [record] = await listRecentAlerts(test.ctx);
    expect(record).toMatchObject({ status: "firing", occurrences: 1, pendingRepeats: 0, resolvedAt: null });
    expectMessage((await listDeliveries(test))[2]!.message, { kind: "fired", occurrences: 1 });
  });
});

describe("flushAlertRepeats", () => {
  it("summarizes repeats once the window has passed, and only once", async () => {
    const test = await setup();
    await alert(test.ctx, INPUT);
    await alert(test.ctx, INPUT);
    await alert(test.ctx, INPUT);
    expect(await flushAlertRepeats(test.ctx)).toEqual({ summarized: 0, pruned: 0 });
    test.clock.advance(HOUR_MS);
    expect(await flushAlertRepeats(test.ctx)).toEqual({ summarized: 1, pruned: 0 });
    expect(await flushAlertRepeats(test.ctx)).toEqual({ summarized: 0, pruned: 0 });
    const deliveries = await listDeliveries(test);
    expect(deliveries).toHaveLength(2);
    expectMessage(deliveries[1]!.message, { kind: "repeated", repeats: 2, occurrences: 3 });
  });

  it("deletes resolved alerts after the retention", async () => {
    const test = await setup({ channels: { ops: recordingChannel().channel }, retentionDays: 1 });
    await alert(test.ctx, INPUT);
    await resolveAlert(test.ctx, INPUT.key);
    await alert(test.ctx, { ...INPUT, key: "still.firing" });
    test.clock.advance(25 * HOUR_MS);
    expect(await flushAlertRepeats(test.ctx)).toEqual({ summarized: 0, pruned: 1 });
    expect((await listRecentAlerts(test.ctx)).map((record) => record.key)).toEqual(["still.firing"]);
  });
});

describe("listRecentAlerts", () => {
  it("lists the alerts seen last first, filtered by status", async () => {
    const test = await setup();
    await alert(test.ctx, { ...INPUT, key: "first" });
    test.clock.advance(MINUTE_MS);
    await alert(test.ctx, { ...INPUT, key: "second" });
    await resolveAlert(test.ctx, "first");
    expect((await listRecentAlerts(test.ctx)).map((record) => record.key)).toEqual(["second", "first"]);
    expect((await listRecentAlerts(test.ctx, { status: "resolved" })).map((record) => record.key)).toEqual(["first"]);
    expect(await listRecentAlerts(test.ctx, { limit: 1 })).toHaveLength(1);
  });

  it("is backed by a table the database constrains", async () => {
    const test = await setup();
    await expect(
      test.ctx.db.insert(alertsTable).values({
        key: "bad key",
        severity: "info",
        title: "t",
        status: "firing",
        occurrences: 1,
        pendingRepeats: 0,
        openedAt: NOW,
        lastSeenAt: NOW,
        lastNotifiedAt: NOW,
      }),
    ).rejects.toThrow();
  });
});
