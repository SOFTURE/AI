// Reading and changing an account's entitlement. An account without a row is on the trial that
// starts at its `auth.users.created_at` (or at `trial.startsAt` when later), derived on every read,
// so reads never write. A change pins that derived record into a row first, then applies the event
// under the row's lock.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { getDayNumber, getStartOfDay, parseDay } from "../calendar.js";
import type { BillingErrorCode, Entitlement, EntitlementEvent, EntitlementRecord } from "../contract.js";
import { applyEntitlementEvent, resolveEntitlement } from "../entitlement.js";
import { entitlements } from "../schema.js";
import { getBillingOptions, getEntitlementPolicy } from "./options.js";
import { isUserId } from "./user-id.js";

export type BillingContext = ModuleContext<Queryable>;

/**
 * The local day an account without a row starts its trial on: the day it was created, or
 * `trial.startsAt` when that is later.
 */
function getTrialStartDay(ctx: Pick<BillingContext, "config">, accountCreatedAt: Date): number {
  const createdDay = getDayNumber(accountCreatedAt, ctx.config.timezone);
  const floorDay = getTrialFloorDay(ctx);
  return floorDay === null ? createdDay : Math.max(createdDay, floorDay);
}

/** The day number of `trial.startsAt`, or null without one. */
export function getTrialFloorDay(ctx: Pick<BillingContext, "config">): number | null {
  const { startsAt } = getBillingOptions(ctx.config).trial;
  if (startsAt === undefined) return null;
  const day = parseDay(startsAt);
  // The option's schema refused anything else at startup.
  if (day === null) throw new Error(`@softure-ai/billing: trial.startsAt "${startsAt}" is not a calendar day`);
  return day;
}

/**
 * The trial an account without a row is on: `trial.days` from the day it was created, or from
 * `trial.startsAt` for an account created before that day.
 */
export function getDefaultRecord(ctx: Pick<BillingContext, "config">, accountCreatedAt: Date): EntitlementRecord {
  const trialEndsAt = getStartOfDay(getTrialStartDay(ctx, accountCreatedAt) + getBillingOptions(ctx.config).trial.days, ctx.config.timezone);
  return { trialEndsAt, paidUntil: null, isLifetime: false };
}

/** The account's stored or derived record, or null when no account has this id. */
export async function findEntitlementRecord(ctx: Pick<BillingContext, "db" | "config">, userId: string): Promise<EntitlementRecord | null> {
  if (!isUserId(userId)) return null;
  const [row] = await ctx.db
    .select({
      accountCreatedAt: users.createdAt,
      trialEndsAt: entitlements.trialEndsAt,
      paidUntil: entitlements.paidUntil,
      isLifetime: entitlements.isLifetime,
    })
    .from(users)
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(eq(users.id, userId));
  if (row === undefined) return null;
  if (row.trialEndsAt === null) return getDefaultRecord(ctx, row.accountCreatedAt);
  return { trialEndsAt: row.trialEndsAt, paidUntil: row.paidUntil, isLifetime: row.isLifetime ?? false };
}

/** Where the account stands now, or null when no account has this id. Database errors propagate. */
export async function getEntitlement(ctx: BillingContext, userId: string): Promise<Entitlement | null> {
  const record = await findEntitlementRecord(ctx, userId);
  return record === null ? null : resolveEntitlement(record, ctx.clock.now(), getEntitlementPolicy(ctx.config));
}

/**
 * The write guard without a framework: `Ok` with the entitlement when the account may write,
 * `billing.read_only` when it may only read, `billing.account_unknown` without an account.
 */
export async function checkWriteAccess(ctx: BillingContext, userId: string): Promise<Ok<Entitlement> | Err<"billing.read_only" | "billing.account_unknown">> {
  const entitlement = await getEntitlement(ctx, userId);
  if (entitlement === null) return err("billing.account_unknown");
  return entitlement.status === "read_only" ? err("billing.read_only") : ok(entitlement);
}

/** The stored record of an account, locked until the transaction ends, or undefined. */
async function lockStoredRecord(tx: Queryable, userId: string): Promise<EntitlementRecord | undefined> {
  const [row] = await tx
    .select({ trialEndsAt: entitlements.trialEndsAt, paidUntil: entitlements.paidUntil, isLifetime: entitlements.isLifetime })
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .for("update");
  return row;
}

/** The event to apply, decided from the account's current record under its lock. */
export type EntitlementEventResolver = (record: EntitlementRecord, now: Date) => EntitlementEvent;

/**
 * Applies `event` to the account's entitlement in one transaction and returns where it stands
 * after; a refused event writes nothing. An account without a row gets one holding its derived
 * trial with the event applied, so the trial end never moves when a row appears. A concurrent
 * change that inserted first is waited for and applied on. Database errors propagate.
 *
 * `event` may be a function of the current record (a paid period that starts where access ends,
 * `grantPlan`); it runs under the lock, so two changes at once both count.
 */
export async function changeEntitlement(
  ctx: BillingContext,
  userId: string,
  event: EntitlementEvent | EntitlementEventResolver,
): Promise<Ok<Entitlement> | Err<BillingErrorCode>> {
  if (!isUserId(userId)) return err("billing.account_unknown");
  const resolveEvent: EntitlementEventResolver = typeof event === "function" ? event : () => event;
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const policy = getEntitlementPolicy(ctx.config);
    // A shared lock: the account cannot be deleted under the change, other changes still read it.
    const [account] = await tx.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).for("key share");
    if (account === undefined) return err("billing.account_unknown");

    const stored = await lockStoredRecord(tx, userId);
    if (stored === undefined) {
      const derived = getDefaultRecord(ctx, account.createdAt);
      const next = applyEntitlementEvent(derived, resolveEvent(derived, now), now);
      if (!next.ok) return next;
      const inserted = await tx
        .insert(entitlements)
        .values({ userId, ...next.value, createdAt: now, updatedAt: now })
        .onConflictDoNothing({ target: entitlements.userId })
        .returning();
      if (inserted.length > 0) return ok(resolveEntitlement(next.value, now, policy));
    }

    // The row existed, or a concurrent change inserted it after the read above (the insert waited
    // for that transaction, so the row is visible now).
    const current = stored ?? (await lockStoredRecord(tx, userId));
    if (current === undefined) throw new Error("@softure-ai/billing: an entitlement row vanished while it was being changed");
    const next = applyEntitlementEvent(current, resolveEvent(current, now), now);
    if (!next.ok) return next;
    await tx
      .update(entitlements)
      .set({ ...next.value, updatedAt: now })
      .where(eq(entitlements.userId, userId));
    return ok(resolveEntitlement(next.value, now, policy));
  });
}

export interface ImportEntitlementInput {
  readonly userId: string;
  /** The trial end the other system knew; omitted or null keeps the account's own. */
  readonly trialEndsAt?: Date | null;
  /** The end of the paid period it knew; omitted or null adds none. */
  readonly paidUntil?: Date | null;
  /** Whether it had lifetime access. */
  readonly isLifetime?: boolean;
}

/**
 * Records what another system knew about an account (a trial end, a paid period, lifetime access)
 * through `changeEntitlement`: merged onto the account's current record, each end only moving
 * later, so an import never takes access away and a repeat changes nothing. Not a recorded grant:
 * it is not in the account's history. Database errors propagate.
 */
export async function importEntitlement(ctx: BillingContext, input: ImportEntitlementInput): Promise<Ok<Entitlement> | Err<"billing.account_unknown">> {
  const changed = await changeEntitlement(ctx, input.userId, {
    type: "import",
    trialEndsAt: input.trialEndsAt ?? null,
    paidUntil: input.paidUntil ?? null,
    isLifetime: input.isLifetime ?? false,
  });
  if (changed.ok) return changed;
  if (changed.error === "billing.account_unknown") return err(changed.error);
  // An import event is never refused.
  throw new Error(`@softure-ai/billing: importing an entitlement failed with ${changed.error}`);
}

/** How many accounts `pinDerivedTrials` reads and writes at a time. */
const PIN_BATCH_SIZE = 500;

/**
 * Writes the derived trial of every account without a row into a row (exactly what reads derive,
 * `trial.startsAt` included), so a later change of `trial.days`, `trial.startsAt` or the time zone
 * moves no existing trial. A row written meanwhile by a change is kept. Returns how many rows it
 * wrote. Run it in a transaction (the `pin-trials` script does) to pin all or nothing. Database
 * errors propagate.
 */
export async function pinDerivedTrials(ctx: BillingContext): Promise<number> {
  const now = ctx.clock.now();
  let pinned = 0;
  let after: string | null = null;
  for (;;) {
    const accounts: { id: string; createdAt: Date }[] = await ctx.db
      .select({ id: users.id, createdAt: users.createdAt })
      .from(users)
      .leftJoin(entitlements, eq(entitlements.userId, users.id))
      .where(after === null ? isNull(entitlements.userId) : and(isNull(entitlements.userId), gt(users.id, after)))
      .orderBy(asc(users.id))
      .limit(PIN_BATCH_SIZE);
    const last = accounts.at(-1);
    if (last === undefined) return pinned;
    const inserted = await ctx.db
      .insert(entitlements)
      .values(accounts.map((account) => ({ userId: account.id, ...getDefaultRecord(ctx, account.createdAt), createdAt: now, updatedAt: now })))
      .onConflictDoNothing({ target: entitlements.userId })
      .returning();
    pinned += inserted.length;
    after = last.id;
  }
}
