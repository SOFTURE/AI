// Sign-ups: joining the waitlist (new or repeat), confirming a request by its link, and reading
// sign-ups back. A request is applied in one transaction: the address's own mailing opt-out is
// lifted (a sign-up is an explicit consent), the stored scopes widen and never narrow (after a lifted
// opt-out, which withdrew every scope, they become the requested ones), and each requested scope the
// consent ledger does not currently grant (never given, withdrawn, or given to an older document
// version) is recorded in privacy.consents. Without double opt-in a request is applied when it is
// made; with it, the request waits on the row with a single-use link until the link is used, and
// nothing is lifted or recorded before. The app's `onJoined` hook runs in the same transaction when
// a sign-up counts for the first time.
import { err, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { liftSuppression } from "@softure-ai/mailing/server";
import { hasConsent, recordConsent } from "@softure-ai/privacy/server";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit, subjectKey } from "@softure-ai/security/server";
import { and, arrayContains, asc, count, eq, isNotNull, isNull, lte, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { WaitlistConfirmationErrorCode, WaitlistErrorCode, WaitlistJoinedEvent, WaitlistSignup } from "../contract.js";
import { signups } from "../schema.js";
import { createConfirmationToken, hashConfirmationToken, isConfirmationTokenShape } from "./confirmation-token.js";
import { getWaitlistOptions } from "./options.js";
import { assertWaitlistSetup, BUCKETS } from "./setup.js";

export type WaitlistContext = ModuleContext<Queryable>;

/** The `source` of the consents the waitlist records. */
export const CONSENT_SOURCE = "waitlist";

const MAX_EMAIL_LENGTH = 254;
const HOUR_MS = 60 * 60 * 1000;
const emailSchema = z.email();
/** A stored channel: 1-64 visible ASCII characters (the table checks the same). */
const CHANNEL_PATTERN = /^[!-~]{1,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface JoinWaitlistInput {
  readonly email: string;
  /** The ids of the checked scopes. */
  readonly scopes: readonly string[];
  /** The placement of the form, one of `waitlist({ placements })`. */
  readonly placement: string;
  /** The client's rate limit key (`identifyClient`). */
  readonly clientKey: string;
  /** The acquisition channel, stored with a first sign-up; 1-64 visible ASCII characters. */
  readonly channel?: string | null;
}

/** A request applied at once (no double opt-in). */
export interface JoinedSignup {
  readonly status: "joined";
  readonly signup: WaitlistSignup;
  /** True for the first sign-up of this address. */
  readonly isNew: boolean;
  /** The scopes whose consent was recorded now. */
  readonly recordedScopes: readonly string[];
}

/** A request that waits for its link (double opt-in): nothing was recorded or lifted yet. */
export interface PendingSignup {
  readonly status: "confirmation_required";
  readonly signup: WaitlistSignup;
  /** True for the first sign-up of this address. */
  readonly isNew: boolean;
  /** The link's token, for `deliverConfirmationMail`. A credential: never log or return it to the client. */
  readonly token: string;
  readonly expiresAt: Date;
}

export type JoinWaitlistResult = Ok<JoinedSignup | PendingSignup> | Err<WaitlistErrorCode> | RateLimitRejection;

export interface ConfirmSignupInput {
  /** The token of the confirmation link. */
  readonly token: string;
  /** The client's rate limit key (`identifyClient`). */
  readonly clientKey: string;
}

export type ConfirmSignupResult =
  | Ok<{
      readonly signup: WaitlistSignup;
      /** The scopes whose consent was recorded now; none for a link already used. */
      readonly recordedScopes: readonly string[];
      /** True when this confirmation made the sign-up count for the first time. */
      readonly isFirstConfirmation: boolean;
    }>
  | Err<WaitlistConfirmationErrorCode>
  | RateLimitRejection;

export type SignupRow = typeof signups.$inferSelect;

export function toSignup(row: SignupRow): WaitlistSignup {
  return {
    id: row.id,
    email: row.email,
    scopes: row.scopes,
    placement: row.placement,
    locale: row.locale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    confirmedAt: row.confirmedAt,
    channel: row.channel,
  };
}

/** Whether `value` can be stored as a channel. */
export function isChannel(value: string): boolean {
  return CHANNEL_PATTERN.test(value);
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
 * `waitlist-email` per address, then, in one transaction, applies the request (`joined`) or, with
 * double opt-in, stores it with a new link that replaces any earlier one (`confirmation_required`).
 * The result does not tell a new address from a known one to the client; `isNew` is for the caller.
 * Database errors propagate.
 */
export async function joinWaitlist(ctx: WaitlistContext, input: JoinWaitlistInput): Promise<JoinWaitlistResult> {
  assertWaitlistSetup(ctx.config);
  const byClient = await consumeRateLimit(ctx, { bucket: BUCKETS.client, key: input.clientKey });
  if (!byClient.ok) return byClient;

  const email = normalizeEmail(input.email);
  if (email === null) return err("waitlist.email_invalid");
  const scopes = checkScopes(ctx, input.scopes, input.placement);
  if (!scopes.ok) return scopes;
  const channel = input.channel ?? null;
  if (channel !== null && !isChannel(channel)) return err("waitlist.form_invalid");
  const byEmail = await consumeRateLimit(ctx, { bucket: BUCKETS.email, key: subjectKey(`email:${email}`) });
  if (!byEmail.ok) return byEmail;

  const request: SignupRequest = { email, scopes: scopes.value, placement: input.placement, channel };
  const doubleOptIn = getWaitlistOptions(ctx.config).doubleOptIn;
  return ctx.db.transaction(async (tx) => {
    const txCtx: WaitlistContext = { ...ctx, db: tx };
    return ok(doubleOptIn === null ? await joinNow(txCtx, request) : await requestConfirmation(txCtx, request, doubleOptIn.expiresInHours));
  });
}

interface SignupRequest {
  readonly email: string;
  /** Checked against the config, in its order. */
  readonly scopes: readonly string[];
  readonly placement: string;
  /** Stored with a first sign-up only. */
  readonly channel: string | null;
}

/** Applies a request at once: a new row confirmed now, or the known row updated. */
async function joinNow(ctx: WaitlistContext, request: SignupRequest): Promise<JoinedSignup> {
  const now = ctx.clock.now();
  const [inserted] = await ctx.db
    .insert(signups)
    .values({ ...request, scopes: [...request.scopes], locale: ctx.config.locale, createdAt: now, updatedAt: now, confirmedAt: now })
    .onConflictDoNothing({ target: signups.email })
    .returning();
  if (inserted !== undefined) {
    await liftSuppression(ctx, request.email);
    const recordedScopes = await recordConsents(ctx, request.email, request.scopes);
    const signup = toSignup(inserted);
    await notifyJoined(ctx, { signup, via: "join" });
    return { status: "joined", signup, isNew: true, recordedScopes };
  }
  const current = await lockSignup(ctx, request.email);
  const applied = await applyRequest(ctx, current, request.scopes);
  const signup = toSignup(applied.row);
  // A row left unconfirmed (double opt-in was on when it was made) counts for the first time now.
  if (current.confirmedAt === null) await notifyJoined(ctx, { signup, via: "join" });
  return { status: "joined", signup, isNew: false, recordedScopes: applied.recordedScopes };
}

/**
 * Stores a request that waits for its link, with a new token that replaces any earlier one. An
 * unconfirmed row takes the requested scopes (nothing was granted yet); a confirmed row keeps its
 * scopes until the link is used.
 */
async function requestConfirmation(ctx: WaitlistContext, request: SignupRequest, expiresInHours: number): Promise<PendingSignup> {
  const now = ctx.clock.now();
  const expiresAt = new Date(now.getTime() + expiresInHours * HOUR_MS);
  const { token, tokenHash } = createConfirmationToken();
  const link = { pendingScopes: [...request.scopes], confirmationTokenHash: tokenHash, confirmationExpiresAt: expiresAt };
  const [inserted] = await ctx.db
    .insert(signups)
    .values({ ...request, scopes: [...request.scopes], locale: ctx.config.locale, createdAt: now, updatedAt: now, confirmedAt: null, ...link })
    .onConflictDoNothing({ target: signups.email })
    .returning();
  if (inserted !== undefined) return { status: "confirmation_required", signup: toSignup(inserted), isNew: true, token, expiresAt };

  const current = await lockSignup(ctx, request.email);
  const [updated] = await ctx.db
    .update(signups)
    .set({ ...link, ...(current.confirmedAt === null ? { scopes: [...request.scopes] } : {}), updatedAt: now })
    .where(eq(signups.id, current.id))
    .returning();
  if (updated === undefined) throw new Error("@softure-ai/waitlist: updating a locked sign-up changed no row");
  return { status: "confirmation_required", signup: toSignup(updated), isNew: false, token, expiresAt };
}

/**
 * Confirms the request behind a link: counts `waitlist` per client, then, under a row lock, applies
 * the pending request. A link already used answers ok with nothing recorded (a second click, a mail
 * preview); a link replaced by a newer one is `confirmation_invalid`. Database errors propagate.
 */
export async function confirmSignup(ctx: WaitlistContext, input: ConfirmSignupInput): Promise<ConfirmSignupResult> {
  assertWaitlistSetup(ctx.config);
  const byClient = await consumeRateLimit(ctx, { bucket: BUCKETS.client, key: input.clientKey });
  if (!byClient.ok) return byClient;
  if (!isConfirmationTokenShape(input.token)) return err("waitlist.confirmation_invalid");

  const tokenHash = hashConfirmationToken(input.token);
  return ctx.db.transaction(async (tx) => {
    const txCtx: WaitlistContext = { ...ctx, db: tx };
    const [current] = await tx.select().from(signups).where(eq(signups.confirmationTokenHash, tokenHash)).for("update");
    if (current === undefined) return err("waitlist.confirmation_invalid");
    if (current.pendingScopes === null) return ok({ signup: toSignup(current), recordedScopes: [], isFirstConfirmation: false });
    if (current.confirmationExpiresAt === null || current.confirmationExpiresAt <= ctx.clock.now()) return err("waitlist.confirmation_expired");

    // A scope the config dropped since the request is not granted.
    const declared = new Set(getWaitlistOptions(ctx.config).scopes.map((scope) => scope.id));
    const requested = current.pendingScopes.filter((id) => declared.has(id));
    if (requested.length === 0) return err("waitlist.confirmation_invalid");
    const applied = await applyRequest(txCtx, current, requested);
    const signup = toSignup(applied.row);
    const isFirstConfirmation = current.confirmedAt === null;
    if (isFirstConfirmation) await notifyJoined(txCtx, { signup, via: "confirmation" });
    return ok({ signup, recordedScopes: applied.recordedScopes, isFirstConfirmation });
  });
}

/** Calls the app's `onJoined` hook in the sign-up's transaction; what it throws rolls the sign-up back. */
async function notifyJoined(ctx: WaitlistContext, event: WaitlistJoinedEvent): Promise<void> {
  await getWaitlistOptions(ctx.config).onJoined?.(event, ctx);
}

/** The sign-up of `email`, locked for the rest of the transaction. */
async function lockSignup(ctx: WaitlistContext, email: string): Promise<SignupRow> {
  const [current] = await ctx.db.select().from(signups).where(eq(signups.email, email)).for("update");
  // The caller just found this row (an insert conflict), and only the privacy contributor and the
  // prune delete rows.
  if (current === undefined) throw new Error("@softure-ai/waitlist: a sign-up vanished while it was being updated");
  return current;
}

/**
 * Applies a request to a locked row: lifts the address's own opt-out, sets the scopes (the requested
 * ones for a row that never counted or after a lifted opt-out, else the union), marks the row
 * confirmed, clears a pending request and records the consents.
 */
async function applyRequest(ctx: WaitlistContext, current: SignupRow, requested: readonly string[]): Promise<{ row: SignupRow; recordedScopes: string[] }> {
  const isOptOutLifted = await liftSuppression(ctx, current.email);
  const next = current.confirmedAt === null || isOptOutLifted ? [...requested] : getWidenedScopes(ctx, current.scopes, requested);
  const isUnchanged =
    current.confirmedAt !== null &&
    current.pendingScopes === null &&
    next.length === current.scopes.length &&
    next.every((scope, index) => current.scopes[index] === scope);

  let row = current;
  if (!isUnchanged) {
    const now = ctx.clock.now();
    const [updated] = await ctx.db
      .update(signups)
      .set({ scopes: next, confirmedAt: current.confirmedAt ?? now, pendingScopes: null, updatedAt: now })
      .where(eq(signups.id, current.id))
      .returning();
    if (updated === undefined) throw new Error("@softure-ai/waitlist: updating a locked sign-up changed no row");
    row = updated;
  }
  return { row, recordedScopes: await recordConsents(ctx, current.email, requested) };
}

/** The union of the stored and the requested scopes, declared ones in the config's order first. */
export function getWidenedScopes(ctx: WaitlistContext, stored: readonly string[], requested: readonly string[]): string[] {
  const granted = new Set([...stored, ...requested]);
  const order = getWaitlistOptions(ctx.config).scopes.map((scope) => scope.id);
  // Scopes the config no longer declares stay, after the declared ones: a sign-up never narrows.
  return [...order.filter((id) => granted.has(id)), ...stored.filter((id) => !order.includes(id))];
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

/**
 * The sign-up with this id, or null (also for a malformed id); confirmed or not. For an app whose old
 * unsubscribe links carry the id of its own list (imported with `importSignups`): its mailing
 * `legacyUnsubscribe.verify` turns the id into the address.
 */
export async function getSignupById(ctx: Pick<WaitlistContext, "db">, id: string): Promise<WaitlistSignup | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const [row] = await ctx.db.select().from(signups).where(eq(signups.id, id.toLowerCase())).limit(1);
  return row === undefined ? null : toSignup(row);
}

/** The sign-up of `email`, or null; confirmed or not (`confirmedAt`). */
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
  /** Only sign-ups from this channel; `null` for the ones that came without a channel. */
  readonly channel?: string | null;
}

/** Confirmed sign-ups (the ones that count) oldest first, optionally by scope and placement. */
export async function listSignups(ctx: Pick<WaitlistContext, "db">, filter: ListSignupsFilter = {}): Promise<WaitlistSignup[]> {
  const conditions: SQL[] = [isNotNull(signups.confirmedAt)];
  if (filter.scope !== undefined) conditions.push(arrayContains(signups.scopes, [filter.scope]));
  if (filter.placement !== undefined) conditions.push(eq(signups.placement, filter.placement));
  if (filter.channel !== undefined) conditions.push(filter.channel === null ? isNull(signups.channel) : eq(signups.channel, filter.channel));
  const rows = await ctx.db
    .select()
    .from(signups)
    .where(and(...conditions))
    .orderBy(asc(signups.createdAt), asc(signups.id));
  return rows.map(toSignup);
}

/** How many confirmed sign-ups came from one channel; `channel` is null for the ones without one. */
export interface ChannelCount {
  readonly channel: string | null;
  readonly signups: number;
}

/** Confirmed sign-ups per channel, most first (then by channel, none last); e.g. a per-channel report. */
export async function countSignupsByChannel(ctx: Pick<WaitlistContext, "db">): Promise<ChannelCount[]> {
  const rows = await ctx.db
    .select({ channel: signups.channel, signups: count() })
    .from(signups)
    .where(isNotNull(signups.confirmedAt))
    .groupBy(signups.channel);
  return rows.sort((a, b) => b.signups - a.signups || compareChannels(a.channel, b.channel));
}

function compareChannels(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/**
 * Deletes the sign-ups that never counted and whose link expired, and drops the expired links of
 * confirmed ones; for a scheduled job. Returns how many sign-ups were deleted.
 */
export async function pruneUnconfirmedSignups(ctx: WaitlistContext): Promise<number> {
  const now = ctx.clock.now();
  return ctx.db.transaction(async (tx) => {
    const deleted = await tx
      .delete(signups)
      .where(and(isNull(signups.confirmedAt), lte(signups.confirmationExpiresAt, now)))
      .returning();
    await tx
      .update(signups)
      .set({ pendingScopes: null, confirmationTokenHash: null, confirmationExpiresAt: null })
      .where(and(isNotNull(signups.confirmedAt), lte(signups.confirmationExpiresAt, now)));
    return deleted.length;
  });
}
