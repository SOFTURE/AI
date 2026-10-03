// The waitlist part of a GDPR export and deletion (`@softure-ai/privacy`): the sign-up of the
// account's email address. Sign-ups have no account of their own, so the account's current email
// links them. The consents recorded for the sign-up are privacy's own part.
import { users } from "@softure-ai/auth";
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import { signups } from "../schema.js";

/** What the waitlist holds about one user, as it appears in their export. */
export interface WaitlistUserData {
  readonly signup: {
    readonly scopes: readonly string[];
    readonly placement: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  } | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The account's email (stored normalised by auth), or null when no account has this id. */
async function findAccountEmail(db: Queryable, userId: string): Promise<string | null> {
  if (!UUID.test(userId)) return null;
  const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return account?.email ?? null;
}

export async function exportWaitlistUserData(context: ModuleContext, userId: string): Promise<Ok<WaitlistUserData>> {
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const email = await findAccountEmail(db, userId);
  if (email === null) return ok({ signup: null });
  const [row] = await db
    .select({ scopes: signups.scopes, placement: signups.placement, createdAt: signups.createdAt, updatedAt: signups.updatedAt })
    .from(signups)
    .where(eq(signups.email, email));
  return ok({ signup: row ?? null });
}

export async function deleteWaitlistUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  const db = context.db as Queryable;
  const email = await findAccountEmail(db, userId);
  if (email !== null) await db.delete(signups).where(eq(signups.email, email));
  return ok();
}

export const waitlistPrivacyContributor: PrivacyContributor = {
  exportUserData: exportWaitlistUserData,
  deleteUserData: deleteWaitlistUserData,
};
