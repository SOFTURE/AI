// The account an OpenID Connect identity signs in to. The provider's subject finds it (`auth.identities`), so an
// email change at the provider keeps it; a first sign-in links the account with the same verified email, or creates
// one with an unusable password when the provider may create accounts. One transaction, so two first sign-ins at
// once end with one account and one identity.
import { randomBytes } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq } from "drizzle-orm";
import type { AuthUser } from "../../contract.js";
import type { OidcProvider } from "../../options.js";
import { identities, users } from "../../schema.js";
import { getAuthOptions } from "../options.js";
import { hashPassword } from "../password.js";
import type { AuthContext } from "../sessions.js";

export interface OidcIdentity {
  readonly subject: string;
  /** Verified, trimmed and lowercased. */
  readonly email: string;
}

export type OidcAccountResult = Ok<AuthUser> | Err<"auth.oidc_no_account">;

export async function resolveOidcAccount(ctx: AuthContext, provider: OidcProvider, identity: OidcIdentity): Promise<OidcAccountResult> {
  const options = getAuthOptions(ctx.config);
  const now = ctx.clock.now();

  return ctx.db.transaction(async (tx): Promise<OidcAccountResult> => {
    const txCtx: AuthContext = { ...ctx, db: tx };
    const findLinked = async (): Promise<AuthUser | undefined> => {
      const [row] = await tx
        .select({ id: users.id, email: users.email, createdAt: users.createdAt })
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
      return ok(linked);
    }

    let [user] = await tx
      .select({ id: users.id, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.email, identity.email))
      .limit(1);
    let isCreated = false;
    if (user === undefined) {
      if (!provider.createAccounts) return err("auth.oidc_no_account");
      // Nobody knows this password: the account signs in through its identity (or a reset link, when passwords are on).
      const unusablePassword = await hashPassword(randomBytes(32).toString("base64url"), options.password.scrypt);
      const [created] = await tx
        .insert(users)
        .values({ email: identity.email, passwordHash: unusablePassword, createdAt: now, passwordChangedAt: now })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id, email: users.email, createdAt: users.createdAt });
      isCreated = created !== undefined;
      // Taken meanwhile by another sign-in or a registration: that account is the one to link.
      [user] =
        created === undefined
          ? await tx.select({ id: users.id, email: users.email, createdAt: users.createdAt }).from(users).where(eq(users.email, identity.email)).limit(1)
          : [created];
      if (user === undefined) return err("auth.oidc_no_account");
    }

    await tx
      .insert(identities)
      .values({ provider: provider.id, subject: identity.subject, userId: user.id, email: identity.email, createdAt: now, lastLoginAt: now })
      .onConflictDoNothing();
    // The pair may have been linked meanwhile; an account that already has another subject of this provider is refused.
    const nowLinked = await findLinked();
    if (nowLinked?.id !== user.id) return err("auth.oidc_no_account");
    if (isCreated) await options.onRegistered?.({ user, consent: null, fields: {}, oidcProvider: provider.id }, txCtx);
    return ok(user);
  });
}
