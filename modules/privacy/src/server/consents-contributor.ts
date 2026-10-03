// The privacy module's own part of a GDPR export and deletion: the consent ledger. A user's
// consents are the rows of their account and the rows of their email address recorded before
// the account existed (a waitlist sign-up).
import { users } from "@softure-ai/auth";
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq, or, type SQL } from "drizzle-orm";
import type { ConsentRecord } from "../contract.js";
import { consents } from "../schema.js";
import { getEmailKey, toConsentRecord } from "./consents.js";

/** What privacy holds about one user, as it appears in their export. */
export interface PrivacyUserData {
  /** Every consent given or withdrawn, oldest first; `subject` says whether it names the account or its email. */
  readonly consents: readonly (ConsentRecord & { readonly subject: "account" | "email" })[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The rows of the account and of its email; null when no account has this id. */
async function matchUserConsents(db: Queryable, userId: string): Promise<SQL | null> {
  if (!UUID.test(userId)) return null;
  const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (account === undefined) return eq(consents.userId, userId);
  return or(eq(consents.userId, userId), eq(consents.emailKey, getEmailKey(account.email))) ?? null;
}

export async function exportConsentUserData(context: ModuleContext, userId: string): Promise<Ok<PrivacyUserData>> {
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const condition = await matchUserConsents(db, userId);
  if (condition === null) return ok({ consents: [] });
  const rows = await db.select().from(consents).where(condition).orderBy(asc(consents.recordedAt), asc(consents.id));
  return ok({ consents: rows.map((row) => ({ ...toConsentRecord(row), subject: row.userId === null ? "email" : "account" })) });
}

/** Deletes the user's consents: with the data gone there is nothing left to prove consent for. */
export async function deleteConsentUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  const db = context.db as Queryable;
  const condition = await matchUserConsents(db, userId);
  if (condition !== null) await db.delete(consents).where(condition);
  return ok();
}

export const privacyConsentsContributor: PrivacyContributor = {
  exportUserData: exportConsentUserData,
  deleteUserData: deleteConsentUserData,
};
