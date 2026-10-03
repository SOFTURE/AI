// What a signed-in user does for themselves: download their data and delete their account. The
// caller passes the user id it took from the session (never from the request body); both
// operations count an attempt per user before any work.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { isCurrentPassword } from "@softure-ai/auth/server";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit } from "@softure-ai/security/server";
import { collectUserData, type CollectUserDataResult } from "./collect.js";
import type { PrivacyContext } from "./context.js";
import { eraseUserData } from "./erase.js";
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
  /** Their current password, typed again. */
  readonly password: string;
  /** Whether the "I understand" checkbox was ticked. */
  readonly isConfirmed: boolean;
}

export type DeleteOwnAccountErrorCode = "privacy.confirmation_required" | "privacy.password_invalid" | "privacy.deletion_refused";

export type DeleteOwnAccountResult = Ok<undefined> | Err<DeleteOwnAccountErrorCode> | RateLimitRejection;

/**
 * Deletes the signed-in user's account and data. The confirmation is checked first (cheap, and a
 * missed checkbox should not spend an attempt), then `privacy-delete` is counted, then the password
 * is verified: a session alone cannot delete an account, and the form is no faster a password
 * oracle than the login. Database errors propagate after the rollback.
 */
export async function deleteOwnAccount(ctx: PrivacyContext, input: DeleteOwnAccountInput): Promise<DeleteOwnAccountResult> {
  assertPrivacyBuckets(ctx.config);
  if (!input.isConfirmed) return err("privacy.confirmation_required");

  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.delete, key: userSubjectKey(input.userId) });
  if (!limit.ok) return limit;

  // A fresh error, not one derived from the check: the result then carries nothing of the password.
  if (!(await isCurrentPassword(ctx, input.userId, input.password))) return err("privacy.password_invalid");

  const erased = await eraseUserData(ctx, input.userId);
  return erased.ok ? ok() : erased;
}
