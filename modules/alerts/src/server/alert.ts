// `alert` and `resolveAlert`: one row per key decides whether a message goes out. The first occurrence fires, repeats
// within the window are counted, the first one past the window (or a higher severity) sends the summary, and a
// resolve sends the recovery. Each decision locks the row in one transaction, so racing callers count every
// occurrence once, and the delivery jobs are written in the same transaction: a rolled-back caller sends nothing.
import { err, ok, type Result } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { enqueueJob } from "@softure-ai/jobs/server";
import { and, desc, eq, gt, lte, lt } from "drizzle-orm";
import { z } from "zod";
import {
  ALERT_KEY_PATTERN,
  ALERT_SEVERITIES,
  isAtLeast,
  MAX_DETAILS_LENGTH,
  MAX_LINK_LENGTH,
  MAX_TITLE_LENGTH,
  type AlertInput,
  type AlertMessage,
  type AlertOutcome,
  type AlertRecord,
  type AlertSeverity,
} from "../contract.js";
import { getQuietHoursRelease } from "../quiet-hours.js";
import { ALERTS_DELIVER_QUEUE } from "../queues.js";
import { alerts, type AlertRow } from "../schema.js";
import { getAlertsOptions, type AlertsContext } from "./options.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const FLUSH_BATCH = 100;

const alertInputSchema = z.strictObject({
  key: z.string().regex(ALERT_KEY_PATTERN),
  severity: z.enum(ALERT_SEVERITIES),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).refine((title) => !/[\r\n]/.test(title), "must be one line"),
  details: z.string().trim().min(1).max(MAX_DETAILS_LENGTH).optional(),
  link: z.url({ protocol: /^https?$/ }).max(MAX_LINK_LENGTH).optional(),
});

/** The payload of one delivery job. */
export const deliveryPayloadSchema = z.strictObject({
  channel: z.string(),
  message: z.strictObject({
    kind: z.enum(["fired", "repeated", "resolved", "test"]),
    key: z.string(),
    severity: z.enum(ALERT_SEVERITIES),
    title: z.string(),
    details: z.string().nullable(),
    link: z.string().nullable(),
    repeats: z.number().int().min(0),
    occurrences: z.number().int().min(0),
    at: z.string(),
  }),
});

export type DeliveryPayload = z.infer<typeof deliveryPayloadSchema>;

/**
 * Records one occurrence of `input.key` and, when it is news, enqueues a delivery to every channel whose
 * `minSeverity` it meets: `fired` for a key that is new or resolved, `repeated` with the count when the window since
 * the last message has passed or the severity rose, `counted` otherwise. `alerts.invalid_input` for a key, title,
 * details or link out of bounds. Database failures propagate.
 */
export async function alert(ctx: AlertsContext, input: AlertInput): Promise<Result<AlertOutcome, "alerts.invalid_input">> {
  const parsed = alertInputSchema.safeParse(input);
  if (!parsed.success) return err("alerts.invalid_input");
  const { key, severity, title } = parsed.data;
  const fields = { severity, title, details: parsed.data.details ?? null, link: parsed.data.link ?? null };
  const windowMs = getAlertsOptions(ctx.config).repeatWindowSeconds * 1000;
  const now = ctx.clock.now();

  const outcome = await ctx.db.transaction(async (tx): Promise<AlertOutcome> => {
    const txCtx = { ...ctx, db: tx };
    const fresh = { ...fields, status: "firing" as const, occurrences: 1, pendingRepeats: 0, openedAt: now, lastSeenAt: now, lastNotifiedAt: now, resolvedAt: null };
    const inserted = await tx.insert(alerts).values({ key, ...fresh }).onConflictDoNothing().returning({ key: alerts.key });
    if (inserted.length > 0) {
      await enqueueDeliveries(txCtx, toMessage("fired", key, fresh, now));
      return "fired";
    }
    const row = await lockAlert(tx, key);
    if (row.status === "resolved") {
      await tx.update(alerts).set(fresh).where(eq(alerts.key, key));
      await enqueueDeliveries(txCtx, toMessage("fired", key, fresh, now));
      return "fired";
    }
    const occurrences = row.occurrences + 1;
    const isWindowOver = now.getTime() >= row.lastNotifiedAt.getTime() + windowMs;
    const isEscalation = !isAtLeast(row.severity, severity);
    if (isWindowOver || isEscalation) {
      const next = { ...fields, occurrences, pendingRepeats: 0, lastSeenAt: now, lastNotifiedAt: now };
      await tx.update(alerts).set(next).where(eq(alerts.key, key));
      await enqueueDeliveries(txCtx, toMessage("repeated", key, { ...next, pendingRepeats: row.pendingRepeats + 1 }, now));
      return "repeated";
    }
    await tx.update(alerts).set({ ...fields, occurrences, pendingRepeats: row.pendingRepeats + 1, lastSeenAt: now }).where(eq(alerts.key, key));
    return "counted";
  });
  return ok(outcome);
}

/**
 * Resolves a firing alert and enqueues the recovery, with the repeats not reported yet. False when the key is not
 * firing (unknown or already resolved): resolving is safe to call on every successful check.
 */
export async function resolveAlert(ctx: AlertsContext, key: string): Promise<boolean> {
  const now = ctx.clock.now();
  const wasFiring = await ctx.db.transaction(async (tx) => {
    const [row] = await tx.select().from(alerts).where(and(eq(alerts.key, key), eq(alerts.status, "firing"))).for("update");
    if (row === undefined) return false;
    await tx.update(alerts).set({ status: "resolved", resolvedAt: now, pendingRepeats: 0, lastNotifiedAt: now }).where(eq(alerts.key, key));
    await enqueueDeliveries({ ...ctx, db: tx }, toMessage("resolved", key, row, now));
    return true;
  });
  return wasFiring;
}

export interface FlushSummary {
  /** Alerts whose repeats were sent as a summary. */
  readonly summarized: number;
  /** Resolved alerts deleted after `retentionDays`. */
  readonly pruned: number;
}

/**
 * The `alerts.flush` job: for firing alerts with repeats nobody reported and a window that has passed, enqueues the
 * summary; then deletes alerts resolved more than `retentionDays` ago. Rows another flush holds are skipped.
 */
export async function flushAlertRepeats(ctx: AlertsContext): Promise<FlushSummary> {
  const options = getAlertsOptions(ctx.config);
  const now = ctx.clock.now();
  const windowStart = new Date(now.getTime() - options.repeatWindowSeconds * 1000);
  const summarized = await ctx.db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(alerts)
      .where(and(eq(alerts.status, "firing"), gt(alerts.pendingRepeats, 0), lte(alerts.lastNotifiedAt, windowStart)))
      .orderBy(alerts.lastNotifiedAt)
      .limit(FLUSH_BATCH)
      .for("update", { skipLocked: true });
    for (const row of rows) {
      await tx.update(alerts).set({ pendingRepeats: 0, lastNotifiedAt: now }).where(eq(alerts.key, row.key));
      await enqueueDeliveries({ ...ctx, db: tx }, toMessage("repeated", row.key, row, now));
    }
    return rows.length;
  });
  const cutoff = new Date(now.getTime() - options.retentionDays * DAY_MS);
  const pruned = await ctx.db.delete(alerts).where(and(eq(alerts.status, "resolved"), lt(alerts.resolvedAt, cutoff))).returning({ key: alerts.key });
  return { summarized, pruned: pruned.length };
}

export interface ListRecentAlertsOptions {
  /** Only firing or only resolved alerts; default both. */
  readonly status?: "firing" | "resolved";
  /** Default 50, at most 500. */
  readonly limit?: number;
}

/** The alerts seen last, newest first, for the admin list. */
export async function listRecentAlerts(ctx: Pick<AlertsContext, "db">, options: ListRecentAlertsOptions = {}): Promise<AlertRecord[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50), 1), 500);
  const rows = await ctx.db
    .select()
    .from(alerts)
    .where(options.status === undefined ? undefined : eq(alerts.status, options.status))
    .orderBy(desc(alerts.lastSeenAt), alerts.key)
    .limit(limit);
  return rows.map((row) => ({ ...row }));
}

/** Enqueues one delivery job per channel the message's severity reaches, each due at the end of its quiet hours. */
export async function enqueueDeliveries(ctx: AlertsContext, message: AlertMessage): Promise<number> {
  const { channels } = getAlertsOptions(ctx.config);
  const now = ctx.clock.now();
  let count = 0;
  for (const [name, channel] of Object.entries(channels)) {
    if (!isAtLeast(message.severity, channel.minSeverity)) continue;
    const runAt = getQuietHoursRelease(now, channel.quietHours, message.severity);
    const payload: DeliveryPayload = { channel: name, message };
    await enqueueJob(ctx, { queue: ALERTS_DELIVER_QUEUE, payload, runAt, origin: "alerts" });
    count += 1;
  }
  return count;
}

async function lockAlert(db: Queryable, key: string): Promise<AlertRow> {
  const [row] = await db.select().from(alerts).where(eq(alerts.key, key)).for("update");
  // The insert above just found the row; rows are deleted only once resolved and old, never while a caller holds it.
  if (row === undefined) throw new Error(`@softure-ai/alerts: the alert "${key}" vanished between insert and lock`);
  return row;
}

interface MessageFields {
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly details: string | null;
  readonly link: string | null;
  readonly occurrences: number;
  readonly pendingRepeats: number;
}

function toMessage(kind: AlertMessage["kind"], key: string, fields: MessageFields, at: Date): AlertMessage {
  return {
    kind,
    key,
    severity: fields.severity,
    title: fields.title,
    details: fields.details,
    link: fields.link,
    repeats: fields.pendingRepeats,
    occurrences: fields.occurrences,
    at: at.toISOString(),
  };
}
