// The suppression list: who unsubscribed from list mail. Rows hold the recipient key, never the
// address. Writes are idempotent (a second opt-out keeps the first row), so a mail client that
// retries its one-click POST, or a person who clicks twice, changes nothing. A verified unsubscribe
// also runs the app's `onUnsubscribed` hook in the same transaction; a new explicit consent lifts
// the recipient's own opt-out (`liftSuppression`).
import { err, ok, type ModuleContext, type Result } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq, inArray } from "drizzle-orm";
import type { SuppressionSource, UnsubscribeErrorCode } from "../contract.js";
import { suppressions } from "../schema.js";
import { getMailingOptions } from "./options.js";
import { getRecipientKey, readUnsubscribeSecrets, verifyUnsubscribeToken, type Env, type UnsubscribeToken } from "./unsubscribe-link.js";

export type SuppressionContext = ModuleContext<Queryable>;

/** Whether `address` unsubscribed. Throws on a database failure: callers decide how to fail. */
export async function isSuppressed(ctx: Pick<SuppressionContext, "db">, address: string): Promise<boolean> {
  const rows = await ctx.db
    .select({ recipientKey: suppressions.recipientKey })
    .from(suppressions)
    .where(eq(suppressions.recipientKey, getRecipientKey(address)))
    .limit(1);
  return rows.length > 0;
}

/** Records an opt-out by recipient key. Throws on a database failure. */
async function recordSuppression(ctx: SuppressionContext, recipientKey: string, source: SuppressionSource): Promise<void> {
  await ctx.db.insert(suppressions).values({ recipientKey, source, createdAt: ctx.clock.now() }).onConflictDoNothing();
}

/**
 * Unsubscribes `address` from list mail, for an operator's script or another module (a bounce or
 * complaint handler). Throws on a database failure.
 */
export async function suppressRecipient(ctx: SuppressionContext, address: string, source: SuppressionSource = "operator"): Promise<void> {
  await recordSuppression(ctx, getRecipientKey(address), source);
}

/** The opt-outs a recipient made themselves; only these can be lifted by a new consent. */
const OWN_SOURCES: readonly SuppressionSource[] = ["one-click", "page"];

/**
 * Lifts the opt-out of `address` when the recipient made it themselves (`page`, `one-click`), for a
 * module that just recorded their new explicit consent, in that consent's transaction. An
 * `operator` row (a bounce, a complaint, a script) stays. Returns whether a row was lifted.
 * Throws on a database failure.
 */
export async function liftSuppression(ctx: Pick<SuppressionContext, "db">, address: string): Promise<boolean> {
  const lifted = await ctx.db
    .delete(suppressions)
    .where(and(eq(suppressions.recipientKey, getRecipientKey(address)), inArray(suppressions.source, [...OWN_SOURCES])))
    .returning();
  return lifted.length > 0;
}

/**
 * Unsubscribes the recipient of a signed link and runs `onUnsubscribed` in the same transaction,
 * also when the recipient had already unsubscribed (a retried one-click heals a missed hook). The
 * signature is checked before the database is touched; a link that does not verify is
 * `mailing.invalid_link`. Throws on a database failure or when the hook throws (nothing is stored).
 */
export async function unsubscribe(
  ctx: SuppressionContext,
  token: UnsubscribeToken | null,
  source: Exclude<SuppressionSource, "operator">,
  env: Env = process.env,
): Promise<Result<undefined, UnsubscribeErrorCode>> {
  if (token === null || !verifyUnsubscribeToken(token, readUnsubscribeSecrets(env))) return err("mailing.invalid_link");
  const { onUnsubscribed } = getMailingOptions(ctx.config);
  const { recipientKey } = token;
  await ctx.db.transaction(async (tx) => {
    const txCtx: SuppressionContext = { ...ctx, db: tx };
    await recordSuppression(txCtx, recipientKey, source);
    await onUnsubscribed?.({ recipientKey, source }, txCtx);
  });
  return ok();
}
