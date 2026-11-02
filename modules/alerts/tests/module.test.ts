// The module factory: options with defaults and their refusals, the manifest, and the migration in PGlite.
import { alerts, slackChannel } from "@softure-ai/alerts";
import { checkAlertsTable } from "@softure-ai/alerts/server";
import { defineSoftureConfig } from "@softure-ai/core";
import { createTestDatabase } from "@softure-ai/db/testing";
import { jobs } from "@softure-ai/jobs";
import { describe, expect, it } from "vitest";
import moduleJson from "../module.json" with { type: "json" };
import packageJson from "../package.json" with { type: "json" };

const SLACK = slackChannel({ url: undefined });

describe("alerts()", () => {
  it("applies the defaults", () => {
    const module = alerts({ channels: { ops: SLACK } });
    expect(module.options).toMatchObject({ repeatWindowSeconds: 3600, retentionDays: 30, panelRole: "admin" });
    expect(module.options.channels.ops).toMatchObject({ kind: "slack", minSeverity: "info" });
  });

  it("refuses no channels, a bad channel name, a channel without deliver and a short window", () => {
    expect(() => alerts({ channels: {} })).toThrow(/at least one channel/);
    expect(() => alerts({ channels: { Ops: SLACK } })).toThrow(/lowercase/);
    expect(() => alerts({ channels: { ops: { kind: "x" } as never } })).toThrow(/deliver/);
    expect(() => alerts({ channels: { ops: SLACK }, repeatWindowSeconds: 10 })).toThrow();
    expect(() => alerts({ channels: { ops: { ...SLACK, quietHours: { from: "22:00", to: "07:00", timeZone: "Nowhere" } } } })).toThrow(/time zone/);
  });

  it("keeps module.json in step with the manifest and the package", () => {
    const { manifest } = alerts({ channels: { ops: SLACK } });
    expect(moduleJson).toEqual({ ...manifest, dependsOn: manifest.dependsOn });
    expect(moduleJson.version).toBe(packageJson.version);
  });

  it("needs jobs in the config", () => {
    expect(() =>
      defineSoftureConfig({ database: { url: "pglite://" }, locale: "en", timezone: "UTC", appOrigin: "https://app.example.com", modules: [alerts({ channels: { ops: SLACK } })] }),
    ).toThrow(/jobs/);
  });

  it("migrates and answers its health check", async () => {
    const config = defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "UTC",
      appOrigin: "https://app.example.com",
      modules: [jobs({ queues: { "alerts.deliver": {} } }), alerts({ channels: { ops: SLACK } })],
    });
    const database = await createTestDatabase(config.modules);
    try {
      expect(await checkAlertsTable({ db: database.db, clock: { now: () => new Date() }, config })).toEqual({ ok: true, value: undefined });
    } finally {
      await database.close();
    }
  });
});
