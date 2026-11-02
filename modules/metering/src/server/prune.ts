// Retention of the ledger: charges older than the kept days, and reservations that expired without being settled
// or released (a crashed call). Expired reservations already stop counting; pruning only frees their rows.
import { ok, type Ok } from "@softure-ai/core";
import { and, eq, lt, lte, or } from "drizzle-orm";
import { charges } from "../schema.js";
import type { MeteringContext } from "./spend.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** The longest month plus a day, so a month budget never loses charges of its own period (any time zone). */
export const MIN_KEEP_DAYS = 32;

export interface PruneChargesInput {
  /** Days of charges to keep, counted back from now; at least `MIN_KEEP_DAYS`. */
  readonly keepDays: number;
}

export interface PruneChargesReport {
  readonly deletedCharges: number;
}

export async function pruneCharges(ctx: MeteringContext, input: PruneChargesInput): Promise<Ok<PruneChargesReport>> {
  assertKeepDays("pruneCharges", input.keepDays);
  const now = ctx.clock.now();
  const cutoff = new Date(now.getTime() - input.keepDays * DAY_MS);
  const deleted = await ctx.db
    .delete(charges)
    .where(or(lt(charges.createdAt, cutoff), and(eq(charges.status, "reserved"), lte(charges.expiresAt, now))))
    .returning({ id: charges.id });
  return ok({ deletedCharges: deleted.length });
}

export function assertKeepDays(operation: string, keepDays: number): void {
  if (!Number.isInteger(keepDays) || keepDays < MIN_KEEP_DAYS) {
    throw new RangeError(`${operation}: keepDays must be a whole number of at least ${String(MIN_KEEP_DAYS)}, got ${String(keepDays)}`);
  }
}
