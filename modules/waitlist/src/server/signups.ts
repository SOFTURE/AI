// Sign-ups: joining the waitlist (new or repeat), and reading sign-ups back. A repeat sign-up widens
// the stored scopes and never narrows them. Each requested scope the consent ledger does not
// currently grant (never given, withdrawn, or given to an older document version) is recorded in
// privacy.consents, in the same transaction as the sign-up.
import { err, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { hasConsent, recordConsent } from "@softure-ai/privacy/server";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit, subjectKey } from "@softure-ai/security/server";
import { and, arrayContains, asc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { WaitlistErrorCode, WaitlistSignup } from "../contract.js";
import { signups } from "../schema.js";
import { getWaitlistOptions } from "./options.js";
import { assertWaitlistSetup, BUCKETS } from "./setup.js";

export type WaitlistContext = ModuleContext<Queryable>;

/** The `source` of the consents the waitlist records. */
export const CONSENT_SOURCE = "waitlist";

const MAX_EMAIL_LENGTH = 254;
const emailSchema = z.email();

export interface JoinWaitlistInput {
  readonly email: string;
  /** The ids of the checked scopes. */
  readonly scopes: readonly string[];
  /** The placement of the form, one of `waitlist({ placements })`. */
  readonly placement: string;
  /** The client's rate limit key (`identifyClient`). */
  readonly clientKey: string;
}

export type JoinWaitlistResult =
  | Ok<{
      readonly signup: WaitlistSignup;
      /** True for the first sign-up of this address. */
      readonly isNew: boolean;
      /** The scopes whose consent was recorded now. */
      readonly recordedScopes: readonly string[];
    }>
  | Err<WaitlistErrorCode>
  | RateLimitRejection;

type SignupRow = typeof signups.$inferSelect;

function toSignup(row: SignupRow): WaitlistSignup {
  return {
    id: row.id,
    email: row.email,
    scopes: row.scopes,
    placement: row.placement,
    locale: row.locale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The address trimmed and lowercased, or null when it is not one. */
export function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return normalized.length <= MAX_EMAIL_LENGTH && emailSchema.safeParse(normalized).success ? normalized : null;
}

/** The checked scopes in the config's order, or the reason the form cannot be accepted. */
function checkScopes(ctx: WaitlistContext, requested: readonly string[], placement: string): Ok<string[]> | Err<WaitlistErrorCode> {
  const options = getWaitlistOptions(ctx.config);
  const known = new Set(options.scopes.map((scope) => scope.id));
  if (requested.some((id) => !known.has(id)) || !options.placements.includes(placement)) return err("waitlist.form_invalid");
  const checked = new Set(requested);
  if (checked.size === 0 || options.scopes.some((scope) => scope.required && !checked.has(scope.id))) return err("waitlist.consent_required");
  return ok(options.scopes.filter((scope) => checked.has(scope.id)).map((scope) => scope.id));
}

/**
 * Signs `email` up for the checked scopes: counts `waitlist` per client, checks the form, counts
 * `waitlist-email` per address, then stores the sign-up (or widens a known one) and records the
 * consents in one transaction. The result does not tell a new address from a known one to the
 * client; `isNew` is for the caller. Database errors propagate.
 */
export async function joinWaitlist(ctx: WaitlistContext, input: JoinWaitlistInput): Promise<JoinWaitlistResult> {
  assertWaitlistSetup(ctx.config);
  const byClient = await consumeRateLimit(ctx, { bucket: BUCKETS.client, key: input.clientKey });
  if (!byClient.ok) return byClient;

  const email = normalizeEmail(input.email);
  if (email === null) return err("waitlist.email_invalid");
  const scopes = checkScopes(ctx, input.scopes, input.placement);
  if (!scopes.ok) return scopes;
  const byEmail = await consumeRateLimit(ctx, { bucket: BUCKETS.email, key: subjectKey(`email:${email}`) });
  if (!byEmail.ok) return byEmail;

  return ctx.db.transaction(async (tx) => {
    const txCtx: WaitlistContext = { ...ctx, db: tx };
    const now = ctx.clock.now();
    const inserted = await tx
      .insert(signups)
      .values({ email, scopes: scopes.value, placement: input.placement, locale: ctx.config.locale, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: signups.email })
      .returning();
    const signup = inserted[0] ?? (await widenSignup(txCtx, email, scopes.value));
    const recordedScopes = await recordConsents(txCtx, email, scopes.value);
    return ok({ signup: toSignup(signup), isNew: inserted.length > 0, recordedScopes });
  });
}

/** Adds the scopes a known sign-up lacks, under a row lock, keeping the config's order. */
async function widenSignup(ctx: WaitlistContext, email: string, requested: readonly string[]): Promise<SignupRow> {
  const [current] = await ctx.db.select().from(signups).where(eq(signups.email, email)).for("update");
  // The insert just conflicted on this email, and only the privacy contributor deletes rows.
  if (current === undefined) throw new Error("@softure-ai/waitlist: a sign-up vanished while it was being widened");
  if (requested.every((scope) => current.scopes.includes(scope))) return current;

  const granted = new Set([...current.scopes, ...requested]);
  const order = getWaitlistOptions(ctx.config).scopes.map((scope) => scope.id);
  // Scopes the config no longer declares stay, after the declared ones: a sign-up never narrows.
  const widened = [...order.filter((id) => granted.has(id)), ...current.scopes.filter((id) => !order.includes(id))];
  const [updated] = await ctx.db.update(signups).set({ scopes: widened, updatedAt: ctx.clock.now() }).where(eq(signups.id, current.id)).returning();
  if (updated === undefined) throw new Error("@softure-ai/waitlist: widening a locked sign-up updated no row");
  return updated;
}

/** Records each requested scope the ledger does not currently grant; returns their ids. */
async function recordConsents(ctx: WaitlistContext, email: string, requested: readonly string[]): Promise<string[]> {
  const declared = getWaitlistOptions(ctx.config).scopes;
  const recorded: string[] = [];
  for (const id of requested) {
    if (await hasConsent(ctx, { subject: { email }, purpose: id })) continue;
    const document = declared.find((scope) => scope.id === id)?.document;
    const result = await recordConsent(ctx, { subject: { email }, purpose: id, granted: true, source: CONSENT_SOURCE, ...(document === undefined ? {} : { document }) });
    // The scope id, the source and the email were checked above and the setup assertion covered
    // the document, so a refusal here is a bug.
    if (!result.ok) throw new Error(`@softure-ai/waitlist: recording consent to "${id}" failed with ${result.error}`);
    recorded.push(id);
  }
  return recorded;
}

/** The sign-up of `email`, or null. */
export async function getSignup(ctx: Pick<WaitlistContext, "db">, email: string): Promise<WaitlistSignup | null> {
  const normalized = normalizeEmail(email);
  if (normalized === null) return null;
  const [row] = await ctx.db.select().from(signups).where(eq(signups.email, normalized)).limit(1);
  return row === undefined ? null : toSignup(row);
}

export interface ListSignupsFilter {
  /** Only sign-ups that granted this scope, e.g. the audience of a launch mail. */
  readonly scope?: string;
  /** Only sign-ups from this placement. */
  readonly placement?: string;
}

/** Sign-ups oldest first, optionally by scope and placement. */
export async function listSignups(ctx: Pick<WaitlistContext, "db">, filter: ListSignupsFilter = {}): Promise<WaitlistSignup[]> {
  const conditions: SQL[] = [];
  if (filter.scope !== undefined) conditions.push(arrayContains(signups.scopes, [filter.scope]));
  if (filter.placement !== undefined) conditions.push(eq(signups.placement, filter.placement));
  const rows = await ctx.db
    .select()
    .from(signups)
    .where(and(...conditions))
    .orderBy(asc(signups.createdAt), asc(signups.id));
  return rows.map(toSignup);
}
