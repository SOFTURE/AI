// alertFromHealthReport: a failing check alerts, a passing one resolves, repeats are counted.
import { alertFromHealthReport, listRecentAlerts } from "@softure-ai/alerts/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestAlerts, recordingChannel, type TestAlerts } from "./support.js";

let current: TestAlerts | undefined;

afterEach(async () => {
  await current?.database.close();
  current = undefined;
});

describe("alertFromHealthReport", () => {
  it("alerts failing checks as critical and resolves them once they pass", async () => {
    const test = (current = await createTestAlerts({ channels: { ops: recordingChannel().channel } }));
    const failing = { status: "unavailable", checks: { database: "ok", jobs: "failed", search: "timed_out" } };
    expect(await alertFromHealthReport(test.ctx, failing, { link: "https://app.example.com/api/health" })).toEqual({ ok: true, value: { alerted: ["jobs", "search"], resolved: [] } });
    expect(await alertFromHealthReport(test.ctx, failing)).toEqual({ ok: true, value: { alerted: [], resolved: [] } });
    const records = await listRecentAlerts(test.ctx);
    expect(records.map((record) => [record.key, record.severity, record.title, record.occurrences])).toEqual([
      ["health:jobs", "critical", "Health check jobs is failed", 2],
      ["health:search", "critical", "Health check search is timed_out", 2],
    ]);
    const passing = { checks: { database: "ok", jobs: "ok", search: "ok" } };
    expect(await alertFromHealthReport(test.ctx, passing)).toEqual({ ok: true, value: { alerted: [], resolved: ["jobs", "search"] } });
  });

  it("takes the severity and key prefix of the app", async () => {
    const test = (current = await createTestAlerts({ channels: { ops: recordingChannel().channel } }));
    await alertFromHealthReport(test.ctx, { checks: { database: "failed" } }, { severity: "warning", keyPrefix: "web.health:" });
    expect((await listRecentAlerts(test.ctx)).map((record) => [record.key, record.severity])).toEqual([["web.health:database", "warning"]]);
  });
});
