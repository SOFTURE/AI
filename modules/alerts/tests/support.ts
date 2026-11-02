// Shared setup: an app configuration with jobs and alerts, recording channels and a migrated PGlite database.
import { createTestClock, defineSoftureConfig, err, ok, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { alerts, defineAlertChannel, type AlertChannel, type AlertDelivery, type AlertsOptionsInput, type ChannelResult } from "@softure-ai/alerts";
import type { AlertsContext } from "@softure-ai/alerts/server";
import { alertsJobQueues, alertsJobSchedules } from "@softure-ai/alerts/jobs";
import { jobs } from "@softure-ai/jobs";

export const NOW = new Date("2026-11-02T12:00:00Z");
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;

export interface RecordingChannel {
  readonly channel: AlertChannel;
  readonly deliveries: AlertDelivery[];
  /** The answer of the next deliveries; default ok. */
  respond: () => ChannelResult;
}

export function recordingChannel(options: Pick<AlertChannel, "minSeverity" | "quietHours"> = {}): RecordingChannel {
  const recorder: RecordingChannel = {
    deliveries: [],
    respond: () => ok(),
    channel: defineAlertChannel({
      kind: "recording",
      ...options,
      deliver: (delivery) => {
        recorder.deliveries.push(delivery);
        return Promise.resolve(recorder.respond());
      },
    }),
  };
  return recorder;
}

export function failingWith(code: Parameters<typeof err>[0], retryAfterSeconds?: number): () => ChannelResult {
  return () => (retryAfterSeconds === undefined ? err(code) : { ...err(code), retryAfterSeconds }) as ChannelResult;
}

export function createConfig(options: Partial<AlertsOptionsInput> & { readonly channels: AlertsOptionsInput["channels"] }): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "https://app.example.com",
    modules: [jobs({ queues: { ...alertsJobQueues, "app.sync": {} }, schedules: { ...alertsJobSchedules } }), alerts(options)],
  });
}

export interface TestAlerts {
  readonly ctx: AlertsContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
}

export async function createTestAlerts(options: Partial<AlertsOptionsInput> & { readonly channels: AlertsOptionsInput["channels"] }): Promise<TestAlerts> {
  const config = createConfig(options);
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database };
}
