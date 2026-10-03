// The delivery ledger (mailing.deliveries): a mail goes out at most once per scope and recipient.
// The sender claims the row in one conditional upsert before it calls the provider, then closes it
// with one outcome. A claim left behind by a crash is taken over once it is stale, and the mail is
// sent again with the same idempotency key, so the provider folds it into the first send.
import { type ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { isMailKind } from "../address.js";
import { TRANSACTIONAL_KIND, type MailingErrorCode, type OutgoingMail } from "../contract.js";
import { deliveries } from "../schema.js";
import { sendMail } from "./send-mail.js";
import { getRecipientKey } from "./unsubscribe-link.js";

export type DeliveryContext = ModuleContext<Queryable>;

/** How long a claim may stay open before another sender may take it over. */
export const DEFAULT_STALE_CLAIM_MS = 15 * 60_000;
/** Claims a delivery gets before `mailing.unavailable` becomes its final outcome. */
export const DEFAULT_MAX_ATTEMPTS = 5;

const MAX_SCOPE_LENGTH = 128;
const SCOPE = /^[a-z0-9][a-z0-9._:-]*$/;

export interface Delivery {
  /**
   * What the mail is about, unique per recipient: `campaign:<id>` for campaigns (set by
   * `sendCampaign`), `<module>.<event>:<entity>` for lifecycle mail, e.g.
   * `billing.trial-ending:sub_42`. Lowercase letters, digits and `._:-`, at most 128 characters.
   */
  readonly scope: string;
  /** The mail. Its `kind` is stored with the row; the idempotency key comes from the ledger. */
  readonly mail: OutgoingMail;
  /** The campaign the delivery belongs to; its scope must then be `campaign:<id>`. */
  readonly campaignId?: string;
}

export interface DeliverOptions {
  readonly staleClaimMs?: number;
  readonly maxAttempts?: number;
}

export type DeliveryOutcome =
  /** Sent now; `id` is the provider's message id. */
  | { readonly status: "sent"; readonly id: string }
  /** Refused now, for good (suppressed, rejected, invalid, or unavailable too many times). */
  | { readonly status: "rejected"; readonly reason: MailingErrorCode }
  /** An earlier run already closed this delivery; nothing was sent. */
  | { readonly status: "done"; readonly outcome: "sent" | "rejected" }
  /** Another sender holds a fresh claim; nothing was sent. */
  | { readonly status: "in-flight" }
  /** The provider was unavailable; the claim is released for a later run. */
  | { readonly status: "retry-later" };

/**
 * Sends `delivery.mail` unless the ledger already has an outcome (or a fresh claim) for its scope
 * and recipient, and records the outcome. Throws on a database failure (after a send, the claim
 * stays open and becomes stale, so a later run re-sends with the same idempotency key), for a
 * malformed scope or kind, and when `sendMail` throws.
 */
export async function deliverOnce(ctx: DeliveryContext, delivery: Delivery, options: DeliverOptions = {}): Promise<DeliveryOutcome> {
  const { staleClaimMs = DEFAULT_STALE_CLAIM_MS, maxAttempts = DEFAULT_MAX_ATTEMPTS } = options;
  const kind = delivery.mail.kind ?? TRANSACTIONAL_KIND;
  assertDelivery(delivery, kind);

  const recipientKey = getRecipientKey(delivery.mail.to);
  const key = { scope: delivery.scope, recipientKey };
  const attempt = await claimDelivery(ctx, { ...key, kind, campaignId: delivery.campaignId ?? null, staleClaimMs });
  if (attempt === null) return readClosedDelivery(ctx, key);

  const result = await sendMail(ctx, delivery.mail, { idempotencyKey: `${delivery.scope}:${recipientKey}` });
  const fence = { ...key, attempt };
  if (result.ok) {
    await closeDelivery(ctx, fence, { status: "sent", providerMessageId: result.value.id, reason: null });
    return { status: "sent", id: result.value.id };
  }
  if (result.error === "mailing.unavailable" && attempt < maxAttempts) {
    await releaseDelivery(ctx, fence);
    return { status: "retry-later" };
  }
  await closeDelivery(ctx, fence, { status: "rejected", providerMessageId: null, reason: result.error });
  return { status: "rejected", reason: result.error };
}

function assertDelivery(delivery: Delivery, kind: string): void {
  if (delivery.scope.length > MAX_SCOPE_LENGTH || !SCOPE.test(delivery.scope)) {
    throw new Error(`@softure-ai/mailing: deliverOnce scope "${delivery.scope}" must be lowercase letters, digits and ._:- (at most 128 characters)`);
  }
  if (!isMailKind(kind)) {
    throw new Error(`@softure-ai/mailing: deliverOnce kind "${kind}" must be kebab-case (at most 64 characters)`);
  }
  if (delivery.campaignId !== undefined && delivery.scope !== `campaign:${delivery.campaignId}`) {
    throw new Error(`@softure-ai/mailing: a delivery of campaign "${delivery.campaignId}" must use the scope "campaign:${delivery.campaignId}"`);
  }
}

interface DeliveryKey {
  readonly scope: string;
  readonly recipientKey: string;
}

/**
 * Takes the row in one statement: a new row, a `pending` one, or a claim older than
 * `staleClaimMs`. Resolves with the attempt number that fences the outcome, or `null` when the row
 * is closed or claimed by someone else.
 */
async function claimDelivery(
  ctx: DeliveryContext,
  claim: DeliveryKey & { readonly kind: string; readonly campaignId: string | null; readonly staleClaimMs: number },
): Promise<number | null> {
  const now = ctx.clock.now();
  const staleBefore = new Date(now.getTime() - claim.staleClaimMs);
  const rows = await ctx.db
    .insert(deliveries)
    .values({ scope: claim.scope, recipientKey: claim.recipientKey, kind: claim.kind, campaignId: claim.campaignId, status: "claimed", attempts: 1, claimedAt: now, createdAt: now })
    .onConflictDoUpdate({
      target: [deliveries.scope, deliveries.recipientKey],
      set: { status: "claimed", attempts: sql`${deliveries.attempts} + 1`, claimedAt: now },
      setWhere: or(eq(deliveries.status, "pending"), and(eq(deliveries.status, "claimed"), lt(deliveries.claimedAt, staleBefore))),
    })
    .returning();
  return rows[0]?.attempts ?? null;
}

async function readClosedDelivery(ctx: DeliveryContext, key: DeliveryKey): Promise<DeliveryOutcome> {
  const rows = await ctx.db.select({ status: deliveries.status }).from(deliveries).where(matchKey(key)).limit(1);
  const status = rows[0]?.status;
  if (status === "sent" || status === "rejected") return { status: "done", outcome: status };
  // A fresh claim; `pending` only between another sender's release and this read.
  return { status: "in-flight" };
}

type Fence = DeliveryKey & { readonly attempt: number };

/** Writes the outcome if this sender still holds the claim; a stale holder writes nothing. */
async function closeDelivery(
  ctx: DeliveryContext,
  fence: Fence,
  outcome: { readonly status: "sent" | "rejected"; readonly providerMessageId: string | null; readonly reason: string | null },
): Promise<void> {
  await ctx.db
    .update(deliveries)
    .set({ ...outcome, finishedAt: ctx.clock.now() })
    .where(and(matchKey(fence), eq(deliveries.status, "claimed"), eq(deliveries.attempts, fence.attempt)));
}

async function releaseDelivery(ctx: DeliveryContext, fence: Fence): Promise<void> {
  await ctx.db
    .update(deliveries)
    .set({ status: "pending" })
    .where(and(matchKey(fence), eq(deliveries.status, "claimed"), eq(deliveries.attempts, fence.attempt)));
}

function matchKey(key: DeliveryKey) {
  return and(eq(deliveries.scope, key.scope), eq(deliveries.recipientKey, key.recipientKey));
}
