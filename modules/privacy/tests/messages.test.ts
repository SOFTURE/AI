import { getPrivacyErrorMessage, privacyMessages, type DeleteAccountErrorCode } from "@softure-ai/privacy";
import { describe, expect, it } from "vitest";

const CODES: DeleteAccountErrorCode[] = [
  "privacy.deletion_refused",
  "privacy.password_invalid",
  "privacy.confirmation_required",
  "auth.unauthenticated",
  "security.rate_limited",
  "core.database_failed",
  "core.unexpected",
];

describe("privacy messages", () => {
  it.each(["en", "pl"] as const)("have copy in %s for every code the delete form can show", (locale) => {
    for (const code of CODES) {
      const message = getPrivacyErrorMessage(privacyMessages[locale], code);
      expect(message, code).not.toBe("");
      expect(message === privacyMessages[locale].errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("have copy for the export errors the route returns", () => {
    expect(privacyMessages.en.errors.privacy.export_failed).not.toBe("");
    expect(privacyMessages.pl.errors.privacy.export_too_large).not.toBe(privacyMessages.en.errors.privacy.export_too_large);
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getPrivacyErrorMessage(privacyMessages.en, "privacy.something_new")).toBe(privacyMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getPrivacyErrorMessage(privacyMessages.en, "auth.toString")).toBe(privacyMessages.en.errors.core.unexpected);
  });

  it("are translated, not copied", () => {
    expect(privacyMessages.pl.delete.title).not.toBe(privacyMessages.en.delete.title);
    for (const key of Object.keys(privacyMessages.en.legal) as (keyof typeof privacyMessages.en.legal)[]) {
      expect(privacyMessages.pl.legal[key], key).not.toBe(privacyMessages.en.legal[key]);
      expect(privacyMessages.en.legal[key], key).not.toBe("");
    }
  });
});
