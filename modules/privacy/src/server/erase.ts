// The deletion: every contributor deletes its part of one user's data, in one transaction and in
// deletion order (the app's data first, auth's account last). A refusal or a failure anywhere
// rolls back every contributor: an account is deleted whole or not at all.
import { err, ok, type Err, type ErrorCode, type Ok } from "@softure-ai/core";
import type { PrivacyContext } from "./context.js";
import { getDeletingContributors } from "./contributors.js";

export type EraseUserDataResult = Ok<undefined> | Err<"privacy.deletion_refused">;

/** Thrown inside the transaction to roll it back when a contributor refuses. */
class DeletionRefusal extends Error {
  constructor(
    readonly contributorId: string,
    readonly code: ErrorCode,
  ) {
    super(`contributor "${contributorId}" refused the deletion: ${code}`);
    this.name = "DeletionRefusal";
  }
}

/**
 * Deletes everything the app holds about `userId`. A contributor that must keep data (legal
 * retention) returns an `Err`: nothing is deleted, the result is `privacy.deletion_refused`, and
 * the contributor's id and code are logged. Thrown errors propagate after the rollback.
 */
export async function eraseUserData(ctx: PrivacyContext, userId: string): Promise<EraseUserDataResult> {
  const contributors = getDeletingContributors(ctx.config);
  try {
    await ctx.db.transaction(async (tx) => {
      const txCtx: PrivacyContext = { ...ctx, db: tx };
      for (const contributor of contributors) {
        const result = await contributor.deleteUserData(txCtx, userId);
        if (!result.ok) throw new DeletionRefusal(contributor.id, result.error);
      }
    });
  } catch (error) {
    if (!(error instanceof DeletionRefusal)) throw error;
    console.warn(`@softure-ai/privacy: ${error.message}; nothing was deleted`);
    return err("privacy.deletion_refused");
  }
  return ok();
}
