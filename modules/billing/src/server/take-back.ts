// Taking back what one grant added, shared by a provider refund (`refundPayment`) and an admin's
// revoke (`revokeManualGrant`): a period loses its unused days (a partial refund only its share of
// them) and every period stored after it moves back by as many days, in both tables (provider
// payments and manual grants), so their stored dates keep saying where their access lies; a
// lifetime ends unless something else still pays for it (a partial refund never ends it). Lock order: the caller takes the account (key share), then the entitlement
// (`lockEntitlementRow`), then flips its own row; the shift then updates other rows under the
// entitlement lock, so two take-backs of one account never wait on each other's rows. A refund that
// fails later gives days back (`giveBackDays`) the same way in reverse.
import type { Queryable } from "@softure-ai/db";
import { and, eq, gte, ne, type SQL } from "drizzle-orm";
import type { Entitlement, EntitlementEvent, EntitlementRecord, PaymentGrant } from "../contract.js";
import { resolveEntitlement } from "../entitlement.js";
import { getGrantStart, getRefundEvent, getTakenBackDays, isFullShare, moveBackByDays, moveForwardByDays, type RefundShare } from "../refund.js";
import { entitlements, manualGrants, payments } from "../schema.js";
import { changeEntitlement, findEntitlementRecord, type BillingContext } from "./entitlements.js";
import { getEntitlementPolicy } from "./options.js";

/**
 * Locks the account's entitlement row until the transaction ends (nothing when it has none yet:
 * a check that must hold before the first change pins the row first, `pinEntitlementRow`).
 * Taken before a refund's or a revoke's own row, so every take-back of the account queues here.
 */
export async function lockEntitlementRow(tx: Queryable, userId: string): Promise<void> {
  await tx.select({ userId: entitlements.userId }).from(entitlements).where(eq(entitlements.userId, userId)).for("update");
}

/** Whether a paid payment of the account (other than `exceptId`) bought lifetime access. */
export async function hasPaidLifetimePayment(tx: Queryable, userId: string, exceptId?: string): Promise<boolean> {
  const conditions: SQL[] = [eq(payments.userId, userId), eq(payments.grantKind, "lifetime"), eq(payments.status, "paid")];
  if (exceptId !== undefined) conditions.push(ne(payments.id, exceptId));
  const [other] = await tx.select({ id: payments.id }).from(payments).where(and(...conditions)).limit(1);
  return other !== undefined;
}

/** Whether an active manual grant of the account (other than `exceptId`) gave lifetime access. */
export async function hasActiveManualLifetime(tx: Queryable, userId: string, exceptId?: string): Promise<boolean> {
  const conditions: SQL[] = [eq(manualGrants.userId, userId), eq(manualGrants.grantKind, "lifetime"), eq(manualGrants.status, "active")];
  if (exceptId !== undefined) conditions.push(ne(manualGrants.id, exceptId));
  const [other] = await tx.select({ id: manualGrants.id }).from(manualGrants).where(and(...conditions)).limit(1);
  return other !== undefined;
}

export interface ShiftLaterPeriodsInput {
  readonly userId: string;
  /** Stored periods starting at or after this instant move (the end of the period taken back or given back). */
  readonly after: Date;
  readonly days: number;
  /** `back` when days are taken back, `forward` when a failed refund gives them back. */
  readonly direction: "back" | "forward";
  readonly timezone: string;
}

interface StoredPeriod {
  readonly id: string;
  readonly grantedFrom: Date | null;
  readonly grantedUntil: Date | null;
}

/** The stored period moved by `days` local days in the input's direction. */
function getShiftedPeriod(row: StoredPeriod, input: ShiftLaterPeriodsInput): { grantedFrom: Date; grantedUntil: Date } | null {
  if (row.grantedFrom === null || row.grantedUntil === null) return null;
  const days = input.direction === "back" ? input.days : -input.days;
  return { grantedFrom: moveBackByDays(row.grantedFrom, days, input.timezone), grantedUntil: moveBackByDays(row.grantedUntil, days, input.timezone) };
}

/**
 * Moves the stored periods that follow the one taken back or given back (paid provider payments and
 * active manual grants starting at or after `after`) by the days, so a later refund or revoke of one
 * of them takes back the right days. The caller holds the entitlement lock.
 */
export async function shiftLaterPeriods(tx: Queryable, input: ShiftLaterPeriodsInput): Promise<void> {
  const laterPayments = await tx
    .select({ id: payments.id, grantedFrom: payments.grantedFrom, grantedUntil: payments.grantedUntil })
    .from(payments)
    .where(and(eq(payments.userId, input.userId), eq(payments.grantKind, "period"), eq(payments.status, "paid"), gte(payments.grantedFrom, input.after)));
  for (const row of laterPayments) {
    const shifted = getShiftedPeriod(row, input);
    if (shifted !== null) await tx.update(payments).set(shifted).where(eq(payments.id, row.id));
  }
  const laterGrants = await tx
    .select({ id: manualGrants.id, grantedFrom: manualGrants.grantedFrom, grantedUntil: manualGrants.grantedUntil })
    .from(manualGrants)
    .where(and(eq(manualGrants.userId, input.userId), eq(manualGrants.grantKind, "period"), eq(manualGrants.status, "active"), gte(manualGrants.grantedFrom, input.after)));
  for (const row of laterGrants) {
    const shifted = getShiftedPeriod(row, input);
    if (shifted !== null) await tx.update(manualGrants).set(shifted).where(eq(manualGrants.id, row.id));
  }
}

export interface TakeBackGrantInput {
  readonly userId: string;
  /** What the refunded payment or revoked grant added; null for a payment stored before grants were (revokes paid access). */
  readonly grant: PaymentGrant | null;
  readonly now: Date;
  /** Whether something else still pays for lifetime access; asked under the entitlement lock. */
  readonly hasOtherLifetime: () => Promise<boolean>;
  /** The part of a payment a partial refund returns; omitted to take back the whole grant. */
  readonly share?: RefundShare;
}

/** Where the account stands after a take-back, and the local days its period lost (0 when nothing moved). */
export interface TakeBack {
  readonly entitlement: Entitlement;
  readonly days: number;
}

/** The change taking back `grant` makes, decided under the entitlement lock, or null when it takes nothing back. */
async function getTakeBackEvent(ctx: BillingContext, input: TakeBackGrantInput, record: EntitlementRecord): Promise<EntitlementEvent | null> {
  const { grant, share } = input;
  // A partial refund of a payment without a recorded grant, or of a lifetime, takes nothing back.
  if (!isFullShare(share) && grant?.kind !== "period") return null;
  if (grant === null) return { type: "revoke" };
  if (grant.kind === "lifetime" && (await input.hasOtherLifetime())) return null;
  return getRefundEvent(record, grant, { now: input.now, timezone: ctx.config.timezone, share });
}

/**
 * Takes back what one grant added (its share, for a partial refund), inside the caller's transaction
 * (`ctx.db` is it), and returns where the account stands after and how many days its period lost.
 * The caller locked the account and the entitlement (`lockEntitlementRow`) and flipped its row
 * first: a lifetime granted at the same time is either committed and seen below, or waits for the
 * entitlement lock and is applied after.
 */
export async function takeBackGrant(ctx: BillingContext, input: TakeBackGrantInput): Promise<TakeBack> {
  const tx = ctx.db;
  const record = await findEntitlementRecord(ctx, input.userId);
  // The caller's row references the account, which its key share lock keeps.
  if (record === null) throw new Error("@softure-ai/billing: a grant to take back has no account");
  const event = await getTakeBackEvent(ctx, input, record);
  if (event === null) return { entitlement: resolveEntitlement(record, input.now, getEntitlementPolicy(ctx.config)), days: 0 };
  const { grant } = input;
  const { timezone } = ctx.config;
  let days = 0;
  if (grant?.kind === "period") {
    days = getTakenBackDays(grant, { now: input.now, timezone, share: input.share });
    await shiftLaterPeriods(tx, { userId: input.userId, after: grant.until, days, direction: "back", timezone });
  }
  const changed = await changeEntitlement(ctx, input.userId, event);
  // The account is locked and these events are never refused.
  if (!changed.ok) throw new Error(`@softure-ai/billing: taking back a grant failed with ${changed.error}`);
  return { entitlement: changed.value, days };
}

export interface GiveBackDaysInput {
  readonly userId: string;
  /** The period the refunded payment stores now. */
  readonly grant: Extract<PaymentGrant, { kind: "period" }>;
  /** Whether the payment was still paid (refunded in part) before the failure. */
  readonly isPaid: boolean;
  readonly days: number;
  readonly now: Date;
}

/** Where the account stands after days were given back, and the period the payment pays for now. */
export interface GiveBack {
  readonly entitlement: Entitlement;
  readonly period: Extract<PaymentGrant, { kind: "period" }>;
}

/**
 * Gives back `days` local days a failed refund had taken, inside the caller's transaction, under the
 * same locks as `takeBackGrant`. While the payment is paid and its period still ahead, the days go
 * back right after that period: dated access and every later stored period move forward by them
 * (the take-back in reverse). Otherwise (refunded in full, or the period used up) they are a grant
 * at the end, from the latest of the trial's end, dated access and now, and that is the period the
 * payment pays for.
 */
export async function giveBackDays(ctx: BillingContext, input: GiveBackDaysInput): Promise<GiveBack> {
  const record = await findEntitlementRecord(ctx, input.userId);
  // The caller's payment row references the account, which its key share lock keeps.
  if (record === null) throw new Error("@softure-ai/billing: days to give back have no account");
  const { timezone } = ctx.config;
  const { grant, days, now } = input;
  const { paidUntil } = record;
  let period: GiveBack["period"];
  let until: Date;
  if (input.isPaid && grant.until > now && paidUntil !== null && paidUntil >= grant.until) {
    await shiftLaterPeriods(ctx.db, { userId: input.userId, after: grant.until, days, direction: "forward", timezone });
    period = { kind: "period", from: grant.from, until: moveForwardByDays(grant.until, days, timezone) };
    until = moveForwardByDays(paidUntil, days, timezone);
  } else {
    const from = getGrantStart(record, now);
    until = moveForwardByDays(from, days, timezone);
    period = { kind: "period", from, until };
  }
  const changed = await changeEntitlement(ctx, input.userId, { type: "grant", until });
  // The account is locked and the end lies at least a day past dated access and now.
  if (!changed.ok) throw new Error(`@softure-ai/billing: giving back refunded days failed with ${changed.error}`);
  return { entitlement: changed.value, period };
}
