// The waitlist's side of an unsubscribe. Mailing's opt-out is global across list mail and its link
// carries only the recipient key, so an unsubscribe withdraws every waitlist scope the ledger still
// grants that address. The app wires it in `mailing({ onUnsubscribed: withdrawWaitlistConsents })`;
// it runs in the suppression's transaction, so the opt-out and the withdrawals commit together.
import type { UnsubscribeEvent } from "@softure-ai/mailing";
import { getConsent, recordConsent } from "@softure-ai/privacy/server";
import { getWaitlistOptions } from "./options.js";
import type { WaitlistContext } from "./signups.js";

/** The `source` of the withdrawals an unsubscribe records. */
export const UNSUBSCRIBE_CONSENT_SOURCE = "unsubscribe";

/**
 * Records a withdrawal for each declared scope whose latest record grants it, under the recipient
 * key (privacy's email key of the same address). Nothing for a scope already withdrawn or never
 * given, so a repeated unsubscribe adds no rows. Database errors propagate (and roll the
 * unsubscribe back).
 */
export async function withdrawWaitlistConsents(event: UnsubscribeEvent, ctx: WaitlistContext): Promise<void> {
  const subject = { emailKey: event.recipientKey };
  for (const { id } of getWaitlistOptions(ctx.config).scopes) {
    const state = await getConsent(ctx, { subject, purpose: id });
    if (state === null || !state.granted) continue;
    const result = await recordConsent(ctx, { subject, purpose: id, granted: false, source: UNSUBSCRIBE_CONSENT_SOURCE });
    // Mailing verified the key's signature and the options checked the scope id, so a refusal is a bug.
    if (!result.ok) throw new Error(`@softure-ai/waitlist: withdrawing consent to "${id}" failed with ${result.error}`);
  }
}
