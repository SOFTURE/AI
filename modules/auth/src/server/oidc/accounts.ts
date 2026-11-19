// The account an OpenID Connect identity signs in to. The provider's subject finds it (`auth.identities`), so an
// email change at the provider keeps it; a first sign-in links the account with the same verified email, or creates
// one with an unusable password when the provider may create accounts. One transaction, so two first sign-ins at
// once end with one account and one identity. Linking an account that no provider had verified yet (one registered
// with a password, whose email nobody proved) cancels its password, its sessions and a pending reset link: whoever
// registered that email first may not be its owner, and must not keep a way in to the account the owner now uses.
// An `openSignUp` provider creates none while registration is closed. Every sign-in that carries a display name
// stores it on the account.
import { randomBytes } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq } from "drizzle-orm";
import type { AuthUser } from "../../contract.js";
import type { OidcProvider } from "../../options.js";
import { AUTH_USER_COLUMNS, identities, passwordResets, sessions, users } from "../../schema.js";
import { getAuthOptions } from "../options.js";
import { hashPassword } from "../password.js";
import type { AuthContext } from "../sessions.js";
import { isRegistrationSwitchOn } from "../switches.js";

export interface OidcIdentity {
  readonly subject: string;
  /** Verified, trimmed and lowercased. */
  readonly email: string;
  /** Normalized (`toDisplayName`); null when the token carries none, which keeps the stored one. */
  readonly displayName: string | null;
}

export type OidcAccountResult = Ok<AuthUser> | Err<"auth.oidc_no_account" | "auth.oidc_registration_closed">;

export async function resolveOidcAccount(ctx: AuthContext, provider: OidcProvider, identity: OidcIdentity): Promise<OidcAccountResult> {
  const options = getAuthOptions(ctx.config);
  const now = ctx.clock.now();
  // An open provider creates accounts only while registration is open; read before the transaction, which holds the
  // connection the switch reader would need on a single-connection database.
  const isSignUpClosed = provider.openSignUp && (await isRegistrationSwitchOn(ctx));

  return ctx.db.transaction(async (tx): Promise<OidcAccountResult> => {
    const txCtx: AuthContext = { ...ctx, db: tx };
    const findLinked = async (): Promise<AuthUser | undefined> => {
      const [row] = await tx
        .select(AUTH_USER_COLUMNS)
        .from(identities)
        .innerJoin(users, eq(users.id, identities.userId))
        .where(and(eq(identities.provider, provider.id), eq(identities.subject, identity.subject)))
        .limit(1);
      return row;
    };

    const linked = await findLinked();
    if (linked !== undefined) {
      await tx
        .update(identities)
        .set({ email: identity.email, lastLoginAt: now })
        .where(and(eq(identities.provider, provider.id), eq(identities.subject, identity.subject)));
      return ok(await storeDisplayName(tx, linked, identity.displayName));
    }

    let [user] = await tx
      .select(AUTH_USER_COLUMNS)
      .from(users)
      .where(eq(users.email, identity.email))
      .limit(1);
    let isCreated = false;
    if (user === undefined) {
      if (!provider.createAccounts) return err("auth.oidc_no_account");
      if (isSignUpClosed) return err("auth.oidc_registration_closed");
      // Nobody knows this password: the account signs in through its identity (or a reset link, when passwords are on).
      const unusablePassword = await hashPassword(randomBytes(32).toString("base64url"), options.password.scrypt);
      const [created] = await tx
        .insert(users)
        .values({ email: identity.email, passwordHash: unusablePassword, createdAt: now, passwordChangedAt: now, displayName: identity.displayName })
        .onConflictDoNothing({ target: users.email })
        .returning(AUTH_USER_COLUMNS);
      isCreated = created !== undefined;
      // Taken meanwhile by another sign-in or a registration: that account is the one to link.
      [user] =
        created === undefined
          ? await tx.select(AUTH_USER_COLUMNS).from(users).where(eq(users.email, identity.email)).limit(1)
          : [created];
      if (user === undefined) return err("auth.oidc_no_account");
    }

    const isUnverified = !isCreated && (await hasNoIdentity(tx, user.id));
    await tx
      .insert(identities)
      .values({ provider: provider.id, subject: identity.subject, userId: user.id, email: identity.email, createdAt: now, lastLoginAt: now })
      .onConflictDoNothing();
    // The pair may have been linked meanwhile; an account that already has another subject of this provider is refused.
    const nowLinked = await findLinked();
    if (nowLinked?.id !== user.id) return err("auth.oidc_no_account");
    if (isUnverified) await revokeUnverifiedAccess(tx, { userId: user.id, now, scrypt: options.password.scrypt });
    const signedIn = await storeDisplayName(tx, user, identity.displayName);
    if (isCreated) await options.onRegistered?.({ user: signedIn, consent: null, fields: {}, oidcProvider: provider.id }, txCtx);
    return ok(signedIn);
  });
}

/** The account with the provider's display name stored; unchanged when the token carries none or the same one. */
async function storeDisplayName(db: AuthContext["db"], user: AuthUser, displayName: string | null): Promise<AuthUser> {
  if (displayName === null || displayName === user.displayName) return user;
  await db.update(users).set({ displayName }).where(eq(users.id, user.id));
  return { ...user, displayName };
}

/** Whether no provider identity is linked to the account yet: its email was never proven by a provider. */
async function hasNoIdentity(db: AuthContext["db"], userId: string): Promise<boolean> {
  const [linked] = await db.select({ provider: identities.provider }).from(identities).where(eq(identities.userId, userId)).limit(1);
  return linked === undefined;
}

interface RevokeUnverifiedAccessInput {
  readonly userId: string;
  readonly now: Date;
  readonly scrypt: ReturnType<typeof getAuthOptions>["password"]["scrypt"];
}

/**
 * Ends every way in that existed before the provider proved the email: the password (replaced by one nobody knows),
 * every session and a pending reset link. The sign-in opens its own session afterwards; the owner gets a password
 * back through a reset link.
 */
async function revokeUnverifiedAccess(db: AuthContext["db"], input: RevokeUnverifiedAccessInput): Promise<void> {
  const unusablePassword = await hashPassword(randomBytes(32).toString("base64url"), input.scrypt);
  await db.update(users).set({ passwordHash: unusablePassword, passwordChangedAt: input.now }).where(eq(users.id, input.userId));
  await db.delete(sessions).where(eq(sessions.userId, input.userId));
  await db.delete(passwordResets).where(eq(passwordResets.userId, input.userId));
}
