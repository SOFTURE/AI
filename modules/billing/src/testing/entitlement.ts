// Entitlement fixtures: a row of `billing.entitlements` written (or overwritten) directly, so a test
// sets up access without inserting into the module's table by hand.
import { users } from "@softure-ai/auth";
import type { Queryable } from "@softure-ai/db";
import { eq, sql } from "drizzle-orm";
import type { EntitlementRecord } from "../contract.js";
import { entitlements } from "../schema.js";
import { getDefaultRecord, type BillingContext } from "../server/entitlements.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TestEntitlementInput {
  /** An existing account (`auth.users`); create it first, e.g. with `createTestAccount`. */
  readonly userId: string;
  /**
   * The first instant the trial no longer covers. When absent: the account's derived trial with a
   * billing context, the account's creation (no trial left) with a bare database.
   */
  readonly trialEndsAt?: Date;
  /** The end of dated paid access; none when absent or null. */
  readonly paidUntil?: Date | null;
  /** Lifetime access; false when absent. */
  readonly lifetime?: boolean;
  /** `created_at` and `updated_at`; the context's clock, or the wall clock with a bare database. */
  readonly now?: Date;
}

function isBillingContext(target: Queryable | BillingContext): target is BillingContext {
  return "db" in target && "config" in target && "clock" in target;
}

/**
 * Writes the account's entitlement row and returns the stored record. A second call overwrites the
 * row, so a test can move an account between states; `created_at` stays and `updated_at` never
 * goes before it. Throws for an unknown account: in test setup that is a bug of the test.
 */
export async function createTestEntitlement(target: Queryable | BillingContext, input: TestEntitlementInput): Promise<EntitlementRecord> {
  const ctx = isBillingContext(target) ? target : null;
  const db = ctx === null ? (target as Queryable) : ctx.db;
  const now = input.now ?? ctx?.clock.now() ?? new Date();
  const [account] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, input.userId));
  if (account === undefined) throw new Error(`createTestEntitlement: there is no account with the id "${input.userId}"`);
  const record: EntitlementRecord = {
    trialEndsAt: input.trialEndsAt ?? (ctx === null ? account.createdAt : getDefaultRecord(ctx, account.createdAt).trialEndsAt),
    paidUntil: input.paidUntil ?? null,
    isLifetime: input.lifetime ?? false,
  };
  await db
    .insert(entitlements)
    .values({ userId: input.userId, ...record, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: entitlements.userId,
      set: { ...record, updatedAt: sql`greatest(${entitlements.createdAt}, excluded.updated_at)` },
    });
  return record;
}

/** A named access state; `days` are 24-hour days counted from `now`. */
export type TestEntitlementState =
  /** On the trial, ending `days` (default 7) after now. */
  | { readonly status: "trial"; readonly days?: number }
  /** On dated paid access, ending `days` (default 30) after now; the trial is over. */
  | { readonly status: "paid"; readonly days?: number }
  /** On lifetime access; the trial is over. */
  | { readonly status: "lifetime" }
  /** Read-only since `days` (default 1) before now, after the trial (the default) or after paid access. */
  | { readonly status: "read_only"; readonly reason?: "trial_ended" | "paid_ended"; readonly days?: number };

export interface TestEntitlementStateInput {
  readonly userId: string;
  readonly state: TestEntitlementState;
  /** The instant the state holds at; the context's clock, or the wall clock with a bare database. */
  readonly now?: Date;
}

function getStateRecord(state: TestEntitlementState, now: Date): EntitlementRecord {
  const at = (days: number): Date => new Date(now.getTime() + days * DAY_MS);
  switch (state.status) {
    case "trial":
      return { trialEndsAt: at(state.days ?? 7), paidUntil: null, isLifetime: false };
    case "paid":
      return { trialEndsAt: now, paidUntil: at(state.days ?? 30), isLifetime: false };
    case "lifetime":
      return { trialEndsAt: now, paidUntil: null, isLifetime: true };
    case "read_only": {
      const days = state.days ?? 1;
      if (state.reason === "paid_ended") return { trialEndsAt: at(-days - 1), paidUntil: at(-days), isLifetime: false };
      return { trialEndsAt: at(-days), paidUntil: null, isLifetime: false };
    }
  }
}

/**
 * Puts the account in `state` at `now` by writing its row (`createTestEntitlement`), and returns
 * the stored record. Throws for an unknown account.
 */
export async function setTestEntitlementState(target: Queryable | BillingContext, input: TestEntitlementStateInput): Promise<EntitlementRecord> {
  const now = input.now ?? (isBillingContext(target) ? target.clock.now() : new Date());
  const record = getStateRecord(input.state, now);
  return createTestEntitlement(target, { userId: input.userId, trialEndsAt: record.trialEndsAt, paidUntil: record.paidUntil, lifetime: record.isLifetime, now });
}
