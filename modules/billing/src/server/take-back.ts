// Taking back what one grant added, shared by a provider refund (`refundPayment`) and an admin's
// revoke (`revokeManualGrant`): a period loses its unused days and every period stored after it
// moves back by as many days, in both tables (provider payments and manual grants), so their stored
// dates keep saying where their access lies; a lifetime ends unless something else still pays for
// it. Lock order: the caller takes the account (key share), then the entitlement
// (`lockEntitlementRow`), then flips its own row; the shift then updates other rows under the
// entitlement lock, so two take-backs of one account never wait on each other's rows.
import type { Queryable } from "@softure-ai/db";
import { and, eq, gte, ne, type SQL } from "drizzle-orm";
import type { Entitlement, EntitlementEvent, EntitlementRecord, PaymentGrant } from "../contract.js";
import { resolveEntitlement } from "../entitlement.js";
import { getRefundEvent, getUnusedDays, moveBackByDays } from "../refund.js";
import { entitlements, manualGrants, payments } from "../schema.js";
import { changeEntitlement, findEntitlementRecord, type BillingContext } from "./entitlements.js";
import { getEntitlementPolicy } from "./options.js";

type PeriodGrant = Extract<PaymentGrant, { kind: "period" }>;

/**
 * Locks the account's entitlement row until the transaction ends (nothing when it has none yet).
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

interface ShiftLaterPeriodsInput {
  readonly userId: string;
  /** The period taken back. */
  readonly grant: PeriodGrant;
  readonly days: number;
  readonly timezone: string;
}

interface StoredPeriod {
  readonly id: string;
  readonly grantedFrom: Date | null;
  readonly grantedUntil: Date | null;
}

/** The stored period moved back by `days` local days. */
function getShiftedPeriod(row: StoredPeriod, input: ShiftLaterPeriodsInput): { grantedFrom: Date; grantedUntil: Date } | null {
  if (row.grantedFrom === null || row.grantedUntil === null) return null;
  return { grantedFrom: moveBackByDays(row.grantedFrom, input.days, input.timezone), grantedUntil: moveBackByDays(row.grantedUntil, input.days, input.timezone) };
}

/**
 * Moves the stored periods that follow the one taken back (paid provider payments and active manual
 * grants starting at or after its end) back by the days taken, so a later refund or revoke of one
 * of them takes back the right days.
 */
async function shiftLaterPeriods(tx: Queryable, input: ShiftLaterPeriodsInput): Promise<void> {
  const laterPayments = await tx
    .select({ id: payments.id, grantedFrom: payments.grantedFrom, grantedUntil: payments.grantedUntil })
    .from(payments)
    .where(and(eq(payments.userId, input.userId), eq(payments.grantKind, "period"), eq(payments.status, "paid"), gte(payments.grantedFrom, input.grant.until)));
  for (const row of laterPayments) {
    const shifted = getShiftedPeriod(row, input);
    if (shifted !== null) await tx.update(payments).set(shifted).where(eq(payments.id, row.id));
  }
  const laterGrants = await tx
    .select({ id: manualGrants.id, grantedFrom: manualGrants.grantedFrom, grantedUntil: manualGrants.grantedUntil })
    .from(manualGrants)
    .where(and(eq(manualGrants.userId, input.userId), eq(manualGrants.grantKind, "period"), eq(manualGrants.status, "active"), gte(manualGrants.grantedFrom, input.grant.until)));
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
}

/** The change taking back `grant` makes, decided under the entitlement lock, or null when it takes nothing back. */
async function getTakeBackEvent(ctx: BillingContext, input: TakeBackGrantInput, record: EntitlementRecord): Promise<EntitlementEvent | null> {
  const { grant } = input;
  if (grant === null) return { type: "revoke" };
  if (grant.kind === "lifetime" && (await input.hasOtherLifetime())) return null;
  return getRefundEvent(record, grant, input.now, ctx.config.timezone);
}

/**
 * Takes back what one grant added, inside the caller's transaction (`ctx.db` is it), and returns
 * where the account stands after. The caller locked the account and the entitlement
 * (`lockEntitlementRow`) and flipped its row first: a lifetime granted at the same time is either
 * committed and seen below, or waits for the entitlement lock and is applied after.
 */
export async function takeBackGrant(ctx: BillingContext, input: TakeBackGrantInput): Promise<Entitlement> {
  const tx = ctx.db;
  const record = await findEntitlementRecord(ctx, input.userId);
  // The caller's row references the account, which its key share lock keeps.
  if (record === null) throw new Error("@softure-ai/billing: a grant to take back has no account");
  const event = await getTakeBackEvent(ctx, input, record);
  const { grant } = input;
  const { timezone } = ctx.config;
  if (grant?.kind === "period" && event !== null) {
    await shiftLaterPeriods(tx, { userId: input.userId, grant, days: getUnusedDays(grant, input.now, timezone), timezone });
  }
  if (event === null) return resolveEntitlement(record, input.now, getEntitlementPolicy(ctx.config));
  const changed = await changeEntitlement(ctx, input.userId, event);
  // The account is locked and these events are never refused.
  if (!changed.ok) throw new Error(`@softure-ai/billing: taking back a grant failed with ${changed.error}`);
  return changed.value;
}
