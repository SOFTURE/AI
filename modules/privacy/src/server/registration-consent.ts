// The consent ticked at registration, recorded through auth's `onRegistered` hook: inside the
// account's transaction, so an account never exists without the evidence of its consent.
import type { OnRegisteredHook } from "@softure-ai/auth";
import { getLegalDocuments } from "./legal-documents.js";
import { insertConsent } from "./consents.js";

export interface RegistrationConsentOptions {
  /**
   * The documents the registration checkbox accepts, by id. Defaults to every document declared
   * in `privacy({ documents })`.
   */
  readonly documents?: readonly string[];
}

/** The source of the rows this hook records. */
export const REGISTRATION_SOURCE = "registration";

/**
 * An `onRegistered` hook for `auth({ onRegistered: recordRegistrationConsent() })`: one consent row
 * per accepted document (purpose = document id, its configured version, source `registration`),
 * at the account's creation time. Records nothing when auth's `requireConsent` is off. Throws
 * (rolling the registration back) when no document is declared or one is unknown: a
 * misconfiguration must not create accounts without evidence.
 */
export function recordRegistrationConsent(options: RegistrationConsentOptions = {}): OnRegisteredHook {
  return async (event, ctx) => {
    if (event.consent === null) return;
    const documents = options.documents ?? getLegalDocuments(ctx.config).map((document) => document.id);
    if (documents.length === 0) {
      throw new Error("@softure-ai/privacy: recordRegistrationConsent() has no document to record; declare them in privacy({ documents })");
    }
    for (const document of documents) {
      const recorded = await insertConsent(
        ctx,
        { subject: { userId: event.user.id }, purpose: document, granted: true, document, source: REGISTRATION_SOURCE },
        event.consent.acceptedAt,
      );
      if (!recorded.ok) {
        throw new Error(`@softure-ai/privacy: recording the registration consent to "${document}" failed: ${recorded.error}`);
      }
    }
  };
}
