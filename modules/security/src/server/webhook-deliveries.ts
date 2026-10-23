// The webhook delivery ledger: third-party providers retry a delivery with the same id until they get a 2xx, and a
// signature without a timestamp cannot tell a retry from the first attempt. One row per source and delivery id.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq, lt } from "drizzle-orm";
import { webhookDeliveries } from "../schema.js";
import { getSecurityOptions } from "./options.js";
import type { SecurityContext } from "./rate-limit.js";

export interface WebhookDelivery {
  /** The app's name for the sender, e.g. `github` or `shopify`: lowercase letters, digits, `_`, `.` and `-`. */
  readonly source: string;
  /** The provider's delivery id from its header (e.g. `X-GitHub-Delivery`), 1 to 200 characters. */
  readonly deliveryId: string;
}

/** `true` for the first delivery of the id, `false` for a replay. */
export type RecordDeliveryResult = Ok<boolean> | Err<"security.delivery_id_invalid">;

const SOURCE_PATTERN = /^[a-z][a-z0-9_.-]{0,62}$/;
const MAX_DELIVERY_ID_LENGTH = 200;
// The control characters Postgres' [[:cntrl:]] matches in the table's check.
// eslint-disable-next-line no-control-regex -- the pattern exists to find control characters.
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Records a delivery and says whether it is the first one: `ok(true)` the first time, `ok(false)` for a replay, which
 * the handler acknowledges with 200 and skips. One `INSERT … ON CONFLICT DO NOTHING`, so of two parallel retries
 * exactly one is first.
 *
 * Call it with the work's transaction as `ctx.db`, after the signature check: when the work fails, the record rolls
 * back with it and the provider's retry is processed. Without a shared transaction, call `forgetDelivery` when the
 * work fails. A delivery id that is empty, longer than 200 characters or holds control characters comes from the
 * request, so it is a value (`security.delivery_id_invalid`); a malformed `source` is a bug and throws. Database
 * errors propagate.
 */
export async function recordDeliveryOnce(ctx: SecurityContext, delivery: WebhookDelivery): Promise<RecordDeliveryResult> {
  getSecurityOptions(ctx.config);
  assertSource(delivery.source);
  if (!isDeliveryIdValid(delivery.deliveryId)) {
    return err("security.delivery_id_invalid");
  }
  const inserted = await ctx.db
    .insert(webhookDeliveries)
    .values({ source: delivery.source, deliveryId: delivery.deliveryId, receivedAt: ctx.clock.now() })
    .onConflictDoNothing({ target: [webhookDeliveries.source, webhookDeliveries.deliveryId] })
    .returning({ deliveryId: webhookDeliveries.deliveryId });
  return ok(inserted.length > 0);
}

/** Forgets one delivery, so the provider's next retry is processed: for work that failed outside the record's transaction. */
export async function forgetDelivery(ctx: SecurityContext, delivery: WebhookDelivery): Promise<void> {
  getSecurityOptions(ctx.config);
  assertSource(delivery.source);
  if (!isDeliveryIdValid(delivery.deliveryId)) {
    return;
  }
  await ctx.db
    .delete(webhookDeliveries)
    .where(and(eq(webhookDeliveries.source, delivery.source), eq(webhookDeliveries.deliveryId, delivery.deliveryId)));
}

/**
 * Deletes deliveries received more than `webhookDeliveries.retentionDays` (default 30) ago. Scheduled daily by
 * `@softure-ai/security/jobs`; an app without jobs calls it from its own cron.
 */
export async function pruneWebhookDeliveries(ctx: SecurityContext): Promise<void> {
  const { retentionDays } = getSecurityOptions(ctx.config).webhookDeliveries;
  const cutoff = new Date(ctx.clock.now().getTime() - retentionDays * DAY_MS);
  await ctx.db.delete(webhookDeliveries).where(lt(webhookDeliveries.receivedAt, cutoff));
}

/** Throws on a source that breaks the naming rule: the source is the app's constant, so a bad one is a bug. */
export function assertSource(source: string): void {
  if (!SOURCE_PATTERN.test(source)) {
    throw new RangeError(
      `@softure-ai/security: "${source}" is not a webhook source: lowercase letters, digits, _ . and -, starting with a letter, at most 63`,
    );
  }
}

function isDeliveryIdValid(deliveryId: string): boolean {
  return deliveryId.length >= 1 && deliveryId.length <= MAX_DELIVERY_ID_LENGTH && !CONTROL_CHARACTER.test(deliveryId);
}
