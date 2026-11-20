// What a signed-in user does for themselves: download their data and delete their account. The
// caller passes the user id it took from the session (never from the request body); both
// operations count an attempt per user before any work.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { findLinkedProviders, findRecentProviderSignIn, isCurrentPassword } from "@softure-ai/auth/server";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit } from "@softure-ai/security/server";
import { collectUserData, type CollectUserDataResult } from "./collect.js";
import type { PrivacyContext } from "./context.js";
import { eraseUserData } from "./erase.js";
import { getPrivacyOptions } from "./options.js";
import { assertPrivacyBuckets, BUCKETS, userSubjectKey } from "./rate-limits.js";

export interface ExportOwnDataInput {
  /** The signed-in user, from the session. */
  readonly userId: string;
}

export type ExportOwnDataResult = CollectUserDataResult | RateLimitRejection;

/** The signed-in user's export, counted in `privacy-export`. Database errors propagate. */
export async function exportOwnData(ctx: PrivacyContext, input: ExportOwnDataInput): Promise<ExportOwnDataResult> {
  assertPrivacyBuckets(ctx.config);
  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.export, key: userSubjectKey(input.userId) });
  if (!limit.ok) return limit;
  return collectUserData(ctx, input.userId);
}

export interface DeleteOwnAccountInput {
  /** The signed-in user, from the session. */
  readonly userId: string;
  /** Their current password, typed again; empty or left out when they confirm with a fresh provider sign-in. */
  readonly password?: string;
  /** The request's session token: a provider sign-in that opened this session recently confirms instead of the password. */
  readonly sessionToken?: string | null;
  /** Whether the "I understand" checkbox was ticked. */
  readonly isConfirmed: boolean;
}

export type DeleteOwnAccountErrorCode =
  | "privacy.confirmation_required"
  | "privacy.password_invalid"
  | "privacy.reauthentication_required"
  | "privacy.deletion_refused";

export type DeleteOwnAccountResult = Ok<undefined> | Err<DeleteOwnAccountErrorCode> | RateLimitRejection;

/**
 * Deletes the signed-in user's account and data. The confirmation is checked first (cheap, and a
 * missed checkbox should not spend an attempt), then `privacy-delete` is counted, then the user
 * re-authenticates: with the current password when one is typed, else with a provider sign-in that
 * opened this very session within `deletion.recentSignInMinutes` (an account a provider created has
 * no password its owner knows). A session alone cannot delete an account, and the form is no faster
 * a password oracle than the login. Database errors propagate after the rollback.
 */
export async function deleteOwnAccount(ctx: PrivacyContext, input: DeleteOwnAccountInput): Promise<DeleteOwnAccountResult> {
  assertPrivacyBuckets(ctx.config);
  if (!input.isConfirmed) return err("privacy.confirmation_required");

  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.delete, key: userSubjectKey(input.userId) });
  if (!limit.ok) return limit;

  const reauthenticated = await checkReauthentication(ctx, input);
  if (!reauthenticated.ok) return reauthenticated;

  const erased = await eraseUserData(ctx, input.userId);
  return erased.ok ? ok() : erased;
}

async function checkReauthentication(
  ctx: PrivacyContext,
  input: DeleteOwnAccountInput,
): Promise<Ok<undefined> | Err<"privacy.password_invalid" | "privacy.reauthentication_required">> {
  const password = input.password ?? "";
  // A fresh error, not one derived from the check: the result then carries nothing of the password.
  if (password !== "") return (await isCurrentPassword(ctx, input.userId, password)) ? ok() : err("privacy.password_invalid");
  if (input.sessionToken === undefined || input.sessionToken === null) return err("privacy.reauthentication_required");
  const withinMinutes = getPrivacyOptions(ctx.config).deletion.recentSignInMinutes;
  const provider = await findRecentProviderSignIn(ctx, { userId: input.userId, sessionToken: input.sessionToken, withinMinutes });
  return provider === null ? err("privacy.reauthentication_required") : ok();
}

export interface DeletionReauthentication {
  /** The providers the account signs in with, by id; empty for a password-only account. */
  readonly linkedProviders: readonly string[];
  /** The provider whose recent sign-in opened this session and confirms a deletion without the password, or null. */
  readonly recentProvider: string | null;
}

/** How the signed-in user can confirm a deletion, for the form: its linked providers and a fresh sign-in, if any. */
export async function getDeletionReauthentication(
  ctx: PrivacyContext,
  input: { readonly userId: string; readonly sessionToken: string | null },
): Promise<DeletionReauthentication> {
  const linkedProviders = await findLinkedProviders(ctx, input.userId);
  if (linkedProviders.length === 0 || input.sessionToken === null) return { linkedProviders, recentProvider: null };
  const withinMinutes = getPrivacyOptions(ctx.config).deletion.recentSignInMinutes;
  const recentProvider = await findRecentProviderSignIn(ctx, { userId: input.userId, sessionToken: input.sessionToken, withinMinutes });
  return { linkedProviders, recentProvider };
}
