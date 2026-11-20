// Invitations by email (issue #1406). An admin invites an address with roles; the link carries 32 random bytes, of
// which only the sha256 is stored, and opens the register form limited to that address, which works while
// `auth.registration_closed` is on. Acceptance locks the invitation row, creates the account, marks the invitation
// accepted, grants the invited roles and runs `onRegistered` in one transaction, so a link creates one account at most.
// Every invite, resend, revoke and acceptance writes one audit line to the server log, with ids only.
import { err, ok, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit } from "@softure-ai/security/server";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AuthUser, SignedIn } from "../contract.js";
import { invitations, userRoles, users } from "../schema.js";
import { getAuthOptions, getAuthRoutes } from "./options.js";
import { hashPassword } from "./password.js";
import { assertAuthBuckets, BUCKETS, userSubjectKey } from "./rate-limits.js";
import { pickRegistrationFields, type RegisterInput } from "./register.js";
import { isDeclaredRole } from "./roles.js";
import { createSession, type AuthContext } from "./sessions.js";
// Invitation tokens have the shape of session tokens: the same generator, hash and shape check.
import { createSessionToken, hashSessionToken, isSessionTokenShape } from "./session-token.js";
import { checkNewPassword, parseEmail } from "./validation.js";

const HOUR_MS = 60 * 60 * 1000;
/** The query parameter of the register page that carries an invitation's token. */
export const INVITATION_TOKEN_PARAM = "invitation";
/** The most invitations the admin page lists, newest first. */
const LIST_LIMIT = 200;
const MAX_ROLES = 16;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether invitations are offered at all: passwords are on and the app passed a sender. */
export function isInvitationEnabled(config: SoftureConfig): boolean {
  const options = getAuthOptions(config);
  return options.password.enabled && options.invitations.send !== undefined;
}

/** The link the sender delivers: the register route on `appOrigin`, with the token in the query. */
export function getInvitationLink(config: SoftureConfig, token: string): string {
  const link = new URL(getAuthRoutes(config).register, config.appOrigin);
  link.searchParams.set(INVITATION_TOKEN_PARAM, token);
  return link.href;
}

/** An audit line: the event and ids, never the email or the link. */
function logInvitationEvent(event: "invited" | "resent" | "revoked" | "accepted", fields: Readonly<Record<string, string>>): void {
  const details = Object.entries(fields)
    .map(([name, value]) => `${name}=${value}`)
    .join(" ");
  console.info(`@softure-ai/auth: audit invitation.${event} ${details}`);
}

/** The pending, unexpired invitation matching the clauses. */
function isLive(now: Date) {
  return and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, now));
}

export type InvitationStatus = "pending" | "expired" | "accepted" | "revoked";

/** One invitation as the admin page shows it. */
export interface InvitationView {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly status: InvitationStatus;
  /** The admin who sent it; null when that account is gone. */
  readonly invitedBy: { readonly id: string; readonly email: string } | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
}

/** The newest invitations (at most 200), with their status at the context's clock. Reads only. */
export async function listInvitations(ctx: AuthContext): Promise<InvitationView[]> {
  const inviter = alias(users, "inviter");
  const rows = await ctx.db
    .select({
      id: invitations.id,
      email: invitations.email,
      roles: invitations.roles,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
      inviterId: inviter.id,
      inviterEmail: inviter.email,
    })
    .from(invitations)
    .leftJoin(inviter, eq(inviter.id, invitations.invitedBy))
    .orderBy(desc(invitations.createdAt), desc(invitations.id))
    .limit(LIST_LIMIT);
  const now = ctx.clock.now();
  return rows.map(({ inviterId, inviterEmail, ...row }) => ({
    ...row,
    status: getStatus(row, now),
    invitedBy: inviterId === null || inviterEmail === null ? null : { id: inviterId, email: inviterEmail },
  }));
}

function getStatus(row: { readonly acceptedAt: Date | null; readonly revokedAt: Date | null; readonly expiresAt: Date }, now: Date): InvitationStatus {
  if (row.acceptedAt !== null) return "accepted";
  if (row.revokedAt !== null) return "revoked";
  return row.expiresAt.getTime() > now.getTime() ? "pending" : "expired";
}

export interface InviteInput {
  readonly email: string;
  /** Declared role names the account will hold; repeats are dropped. */
  readonly roles: readonly string[];
  /** The admin who invites; the caller checked the role. */
  readonly inviterId: string;
}

export type InviteErrorCode = "auth.invitations_unavailable" | "auth.email_invalid" | "auth.email_taken" | "auth.role_undeclared";

export type InviteResult = Ok<{ readonly invitationId: string }> | Err<InviteErrorCode> | RateLimitRejection;

/**
 * Invites `email`: counts `invitation` for the inviter, refuses an address that already has an account, stores a new
 * link (refreshing the pending invitation of that address: new token, roles, inviter and expiry) and hands it to the
 * app's sender. The caller must have checked that the inviter is an admin. Sender and database errors propagate; the
 * invitation then stays pending and can be resent.
 */
export async function inviteUser(ctx: AuthContext, input: InviteInput): Promise<InviteResult> {
  assertAuthBuckets(ctx.config);
  if (!isInvitationEnabled(ctx.config)) return err("auth.invitations_unavailable");
  const email = parseEmail(input.email);
  if (!email.ok) return email;
  const roles = [...new Set(input.roles)];
  if (roles.length > MAX_ROLES || roles.some((role) => !isDeclaredRole(ctx.config, role))) return err("auth.role_undeclared");

  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.invitation, key: userSubjectKey(input.inviterId) });
  if (!limit.ok) return limit;

  const [existing] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.email, email.value)).limit(1);
  if (existing !== undefined) return err("auth.email_taken");

  const now = ctx.clock.now();
  const expiresAt = getExpiry(ctx.config, now);
  const { token, tokenHash } = createSessionToken();
  const [row] = await ctx.db
    .insert(invitations)
    .values({ email: email.value, roles, tokenHash, invitedBy: input.inviterId, createdAt: now, expiresAt })
    .onConflictDoUpdate({
      target: invitations.email,
      targetWhere: sql`accepted_at IS NULL AND revoked_at IS NULL`,
      set: { roles, tokenHash, invitedBy: input.inviterId, createdAt: now, expiresAt },
    })
    .returning({ id: invitations.id });
  // An insert or an update always returns its row.
  if (row === undefined) throw new Error("@softure-ai/auth: storing an invitation returned no row");
  logInvitationEvent("invited", { id: row.id, by: input.inviterId });
  await send(ctx, token, email.value, { expiresAt, roles });
  return ok({ invitationId: row.id });
}

export interface InvitationChange {
  readonly invitationId: string;
  /** The admin who acts; the caller checked the role. */
  readonly actorId: string;
}

/**
 * Sends a pending invitation again with a new link and a new expiry (the old link stops working). Counts
 * `invitation` for the admin. `auth.invitation_not_pending` for an accepted, revoked or unknown one (an expired one
 * is renewed). Sender and database errors propagate.
 */
export async function resendInvitation(
  ctx: AuthContext,
  change: InvitationChange,
): Promise<Ok<undefined> | Err<"auth.invitations_unavailable" | "auth.invitation_not_pending"> | RateLimitRejection> {
  assertAuthBuckets(ctx.config);
  if (!isInvitationEnabled(ctx.config)) return err("auth.invitations_unavailable");
  if (!UUID.test(change.invitationId)) return err("auth.invitation_not_pending");
  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.invitation, key: userSubjectKey(change.actorId) });
  if (!limit.ok) return limit;

  const now = ctx.clock.now();
  const expiresAt = getExpiry(ctx.config, now);
  const { token, tokenHash } = createSessionToken();
  const [row] = await ctx.db
    .update(invitations)
    .set({ tokenHash, expiresAt })
    .where(and(eq(invitations.id, change.invitationId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id, email: invitations.email, roles: invitations.roles });
  if (row === undefined) return err("auth.invitation_not_pending");
  logInvitationEvent("resent", { id: row.id, by: change.actorId });
  await send(ctx, token, row.email, { expiresAt, roles: row.roles });
  return ok();
}

/** Revokes a pending (or expired) invitation: its link stops working. `auth.invitation_not_pending` otherwise. */
export async function revokeInvitation(ctx: AuthContext, change: InvitationChange): Promise<Ok<undefined> | Err<"auth.invitation_not_pending">> {
  if (!UUID.test(change.invitationId)) return err("auth.invitation_not_pending");
  const [row] = await ctx.db
    .update(invitations)
    .set({ revokedAt: ctx.clock.now() })
    .where(and(eq(invitations.id, change.invitationId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id });
  if (row === undefined) return err("auth.invitation_not_pending");
  logInvitationEvent("revoked", { id: row.id, by: change.actorId });
  return ok();
}

/** A live invitation as its register form needs it. */
export interface OpenInvitation {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
}

/** The live invitation of a token, or null for an unknown, malformed, used, revoked or expired one. Reads only. */
export async function findInvitation(ctx: AuthContext, token: string): Promise<OpenInvitation | null> {
  if (!isInvitationEnabled(ctx.config) || !isSessionTokenShape(token)) return null;
  const [row] = await ctx.db
    .select({ id: invitations.id, email: invitations.email, roles: invitations.roles })
    .from(invitations)
    .where(and(eq(invitations.tokenHash, hashSessionToken(token)), isLive(ctx.clock.now())))
    .limit(1);
  return row ?? null;
}

export interface RegisterInvitedInput extends RegisterInput {
  /** The token of the invitation link. */
  readonly token: string;
}

export type RegisterInvitedErrorCode =
  | "auth.invitation_invalid"
  | "auth.invitation_email_mismatch"
  | "auth.email_invalid"
  | "auth.email_taken"
  | "auth.password_too_short"
  | "auth.password_too_long"
  | "auth.consent_required";

export type RegisterInvitedResult = Ok<SignedIn> | Err<RegisterInvitedErrorCode> | RateLimitRejection;

/**
 * Creates the invited account and signs it in, whether registration is closed or not. The input is checked first, then
 * the `register` bucket is counted, then the link: a dead one is `auth.invitation_invalid`, an email other than the
 * invited one `auth.invitation_email_mismatch`. The account, the accepted mark, the invited roles (those still
 * declared), `onRegistered` and the session share one transaction on the locked invitation row, so a link creates one
 * account at most even when two submissions race. Database errors and errors thrown by the hook propagate after the
 * rollback.
 */
export async function registerInvitedUser(ctx: AuthContext, input: RegisterInvitedInput): Promise<RegisterInvitedResult> {
  const options = getAuthOptions(ctx.config);
  assertAuthBuckets(ctx.config);
  if (!isInvitationEnabled(ctx.config)) return err("auth.invitation_invalid");

  const email = parseEmail(input.email);
  if (!email.ok) return email;
  const passwordPolicy = checkNewPassword(input.password, options.password.minLength);
  // A fresh error, not the check's own result (js/insufficient-password-hash), as in registerUser.
  if (!passwordPolicy.ok) return err(passwordPolicy.error);
  if (options.requireConsent && !input.hasConsented) return err("auth.consent_required");

  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.register, key: input.clientKey });
  if (!limit.ok) return limit;

  const invitation = await findInvitation(ctx, input.token);
  if (invitation === null) return err("auth.invitation_invalid");
  if (invitation.email !== email.value) return err("auth.invitation_email_mismatch");

  const passwordHash = await hashPassword(input.password, options.password.scrypt);
  const now = ctx.clock.now();
  const result = await ctx.db.transaction(async (tx): Promise<Ok<SignedIn> | Err<"auth.invitation_invalid" | "auth.email_taken">> => {
    const txCtx: AuthContext = { ...ctx, db: tx };
    const [locked] = await tx
      .select({ id: invitations.id, roles: invitations.roles })
      .from(invitations)
      .where(and(eq(invitations.id, invitation.id), isLive(now)))
      .for("update");
    if (locked === undefined) return err("auth.invitation_invalid");

    const [row] = await tx
      .insert(users)
      .values({ email: email.value, passwordHash, createdAt: now, passwordChangedAt: now })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (row === undefined) return err("auth.email_taken");
    const user: AuthUser = { id: row.id, email: row.email, createdAt: row.createdAt, displayName: row.displayName };

    await tx.update(invitations).set({ acceptedAt: now, acceptedUserId: user.id }).where(eq(invitations.id, locked.id));
    const roles = locked.roles.filter((role) => isDeclaredRole(ctx.config, role));
    if (roles.length > 0) await tx.insert(userRoles).values(roles.map((role) => ({ userId: user.id, role, grantedAt: now })));

    const fields = pickRegistrationFields(options.registrationFields, input.fields);
    await options.onRegistered?.({ user, consent: options.requireConsent ? { acceptedAt: now } : null, fields, oidcProvider: null }, txCtx);
    const session = await createSession(txCtx, user.id);
    return ok({ user, session });
  });
  if (result.ok) logInvitationEvent("accepted", { id: invitation.id, user: result.value.user.id });
  return result;
}

function getExpiry(config: SoftureConfig, now: Date): Date {
  return new Date(now.getTime() + getAuthOptions(config).invitations.ttlHours * HOUR_MS);
}

async function send(ctx: AuthContext, token: string, email: string, details: { readonly expiresAt: Date; readonly roles: readonly string[] }): Promise<void> {
  const sender = getAuthOptions(ctx.config).invitations.send;
  // isInvitationEnabled checked it before the caller got here.
  if (sender === undefined) throw new Error("@softure-ai/auth: invitations need auth({ invitations: { send } })");
  await sender(getInvitationLink(ctx.config, token), { email }, { ...details, locale: ctx.config.locale });
}
