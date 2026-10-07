// The delivery ledger (mailing.deliveries): a mail goes out at most once per scope and recipient.
// The sender claims the row in one conditional upsert before it calls the provider, then closes it
// with one outcome. A claim left behind by a crash is taken over once it is stale, and the mail is
// sent again with the same idempotency key, so the provider folds it into the first send. A claim
// older than the provider keeps that key is "uncertain": it is taken over only when the operator
// says so. A failure about the sending account (refused key, spent quota) closes nothing: the
// claim goes back, attempt included, so fixing the account and re-running loses no recipient.
import { type ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { isMailKind } from "../address.js";
import { HALTING_ERROR_CODES, TRANSACTIONAL_KIND, type MailingErrorCode, type OutgoingMail } from "../contract.js";
import { DEFAULT_STALE_CLAIM_MS, DEFAULT_UNCERTAIN_CLAIM_MS } from "../options.js";
import { deliveries } from "../schema.js";
import { getMailingOptions } from "./options.js";
import { sendMail } from "./send-mail.js";
import { getRecipientKey } from "./unsubscribe-link.js";

export type DeliveryContext = ModuleContext<Queryable>;

export { DEFAULT_STALE_CLAIM_MS, DEFAULT_UNCERTAIN_CLAIM_MS };
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
  /** Default: the module's `staleClaimMs` (15 minutes). */
  readonly staleClaimMs?: number;
  /** Default: the module's `uncertainClaimMs` (23 hours). */
  readonly uncertainClaimMs?: number;
  /**
   * Takes over uncertain claims too (older than `uncertainClaimMs`), accepting that their mail may arrive twice.
   * An operator's decision, e.g. `softure-mail campaign --resend-uncertain`. Default false.
   */
  readonly retakeUncertain?: boolean;
  readonly maxAttempts?: number;
}

/** The codes that stop a run: the sending account, not the mail, is the problem. */
export type HaltingErrorCode = "mailing.provider_refused" | "mailing.quota_exceeded";

export type DeliveryOutcome =
  /** Sent now; `id` is the provider's message id. */
  | { readonly status: "sent"; readonly id: string }
  /** Refused now, for good (suppressed, rejected, invalid, or unavailable too many times). */
  | { readonly status: "rejected"; readonly reason: MailingErrorCode; readonly httpStatus?: number }
  /** An earlier run already closed this delivery; nothing was sent. */
  | { readonly status: "done"; readonly outcome: "sent" | "rejected" }
  /** Another sender holds a fresh claim; nothing was sent. */
  | { readonly status: "in-flight" }
  /**
   * A claim older than `uncertainClaimMs` is open: its mail may have gone out. Nothing was sent; only
   * `retakeUncertain` sends it again.
   */
  | { readonly status: "uncertain" }
  /** The provider was unavailable; the claim is released for a later run. */
  | { readonly status: "retry-later"; readonly httpStatus?: number }
  /**
   * The provider refused the account or its quota is spent: the claim is released, its attempt given back. Stop
   * sending (every other mail fails the same way) and run again once the account can send.
   */
  | { readonly status: "halted"; readonly reason: HaltingErrorCode; readonly httpStatus?: number };

/**
 * Sends `delivery.mail` unless the ledger already has an outcome (or a fresh claim) for its scope
 * and recipient, and records the outcome. Throws on a database failure (after a send, the claim
 * stays open and becomes stale, so a later run re-sends with the same idempotency key), for a
 * malformed scope or kind, and when `sendMail` throws.
 */
export async function deliverOnce(ctx: DeliveryContext, delivery: Delivery, options: DeliverOptions = {}): Promise<DeliveryOutcome> {
  const windows = resolveClaimWindows(ctx, options);
  const { maxAttempts = DEFAULT_MAX_ATTEMPTS } = options;
  const kind = delivery.mail.kind ?? TRANSACTIONAL_KIND;
  assertDelivery(delivery, kind);

  const recipientKey = getRecipientKey(delivery.mail.to);
  const key = { scope: delivery.scope, recipientKey };
  const attempt = await claimDelivery(ctx, { ...key, kind, campaignId: delivery.campaignId ?? null, ...windows });
  if (attempt === null) return readClosedDelivery(ctx, key, windows.uncertainClaimMs);

  const result = await sendMail(ctx, delivery.mail, { idempotencyKey: `${delivery.scope}:${recipientKey}` });
  const fence = { ...key, attempt };
  if (result.ok) {
    await closeDelivery(ctx, fence, { status: "sent", providerMessageId: result.value.id, reason: null, providerStatus: null });
    return { status: "sent", id: result.value.id };
  }
  const providerStatus = result.httpStatus ?? null;
  const httpStatus = result.httpStatus === undefined ? {} : { httpStatus: result.httpStatus };
  if (isHaltingCode(result.error)) {
    await releaseDelivery(ctx, fence, { providerStatus, giveAttemptBack: true });
    return { status: "halted", reason: result.error, ...httpStatus };
  }
  if (result.error === "mailing.unavailable" && attempt < maxAttempts) {
    await releaseDelivery(ctx, fence, { providerStatus, giveAttemptBack: false });
    return { status: "retry-later", ...httpStatus };
  }
  await closeDelivery(ctx, fence, { status: "rejected", providerMessageId: null, reason: result.error, providerStatus });
  return { status: "rejected", reason: result.error, ...httpStatus };
}

function isHaltingCode(code: MailingErrorCode): code is HaltingErrorCode {
  return HALTING_ERROR_CODES.has(code);
}

interface ClaimWindows {
  readonly staleClaimMs: number;
  readonly uncertainClaimMs: number;
  readonly retakeUncertain: boolean;
}

/** The claim windows: the call's options, else the module's, else the defaults. */
function resolveClaimWindows(ctx: DeliveryContext, options: DeliverOptions): ClaimWindows {
  const configured = getMailingOptions(ctx.config);
  const staleClaimMs = options.staleClaimMs ?? configured.staleClaimMs;
  const uncertainClaimMs = options.uncertainClaimMs ?? configured.uncertainClaimMs;
  if (uncertainClaimMs <= staleClaimMs) {
    throw new Error(`@softure-ai/mailing: uncertainClaimMs (${String(uncertainClaimMs)}) must be more than staleClaimMs (${String(staleClaimMs)})`);
  }
  return { staleClaimMs, uncertainClaimMs, retakeUncertain: options.retakeUncertain ?? false };
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
 * `staleClaimMs` (and, unless `retakeUncertain`, not older than `uncertainClaimMs`). Resolves with
 * the attempt number that fences the outcome, or `null` when the row is closed, claimed by someone
 * else, or uncertain.
 */
async function claimDelivery(ctx: DeliveryContext, claim: DeliveryKey & ClaimWindows & { readonly kind: string; readonly campaignId: string | null }): Promise<number | null> {
  const now = ctx.clock.now();
  const staleBefore = new Date(now.getTime() - claim.staleClaimMs);
  const uncertainBefore = new Date(now.getTime() - claim.uncertainClaimMs);
  const isStale: SQL | undefined = claim.retakeUncertain
    ? lt(deliveries.claimedAt, staleBefore)
    : and(lt(deliveries.claimedAt, staleBefore), gte(deliveries.claimedAt, uncertainBefore));
  const rows = await ctx.db
    .insert(deliveries)
    .values({ scope: claim.scope, recipientKey: claim.recipientKey, kind: claim.kind, campaignId: claim.campaignId, status: "claimed", attempts: 1, claimedAt: now, createdAt: now })
    .onConflictDoUpdate({
      target: [deliveries.scope, deliveries.recipientKey],
      set: { status: "claimed", attempts: sql`${deliveries.attempts} + 1`, claimedAt: now },
      setWhere: or(eq(deliveries.status, "pending"), and(eq(deliveries.status, "claimed"), isStale)),
    })
    .returning();
  return rows[0]?.attempts ?? null;
}

async function readClosedDelivery(ctx: DeliveryContext, key: DeliveryKey, uncertainClaimMs: number): Promise<DeliveryOutcome> {
  const rows = await ctx.db.select({ status: deliveries.status, claimedAt: deliveries.claimedAt }).from(deliveries).where(matchKey(key)).limit(1);
  const row = rows[0];
  if (row?.status === "sent" || row?.status === "rejected") return { status: "done", outcome: row.status };
  if (row?.status === "claimed" && row.claimedAt.getTime() < ctx.clock.now().getTime() - uncertainClaimMs) return { status: "uncertain" };
  // A fresh claim; `pending` only between another sender's release and this read.
  return { status: "in-flight" };
}

type Fence = DeliveryKey & { readonly attempt: number };

/** Writes the outcome if this sender still holds the claim; a stale holder writes nothing. */
async function closeDelivery(
  ctx: DeliveryContext,
  fence: Fence,
  outcome: { readonly status: "sent" | "rejected"; readonly providerMessageId: string | null; readonly reason: string | null; readonly providerStatus: number | null },
): Promise<void> {
  await ctx.db
    .update(deliveries)
    .set({ ...outcome, finishedAt: ctx.clock.now() })
    .where(and(matchKey(fence), eq(deliveries.status, "claimed"), eq(deliveries.attempts, fence.attempt)));
}

/**
 * Puts the claim back for a later run. A halt gives its attempt back: the account's failure says
 * nothing about this mail, so it must not bring the delivery closer to `maxAttempts`.
 */
async function releaseDelivery(ctx: DeliveryContext, fence: Fence, release: { readonly providerStatus: number | null; readonly giveAttemptBack: boolean }): Promise<void> {
  await ctx.db
    .update(deliveries)
    .set({ status: "pending", providerStatus: release.providerStatus, ...(release.giveAttemptBack ? { attempts: fence.attempt - 1 } : {}) })
    .where(and(matchKey(fence), eq(deliveries.status, "claimed"), eq(deliveries.attempts, fence.attempt)));
}

function matchKey(key: DeliveryKey) {
  return and(eq(deliveries.scope, key.scope), eq(deliveries.recipientKey, key.recipientKey));
}
