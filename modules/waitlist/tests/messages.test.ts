import { getWaitlistErrorMessage, waitlistMessages, type WaitlistFormErrorCode } from "@softure-ai/waitlist";
import { describe, expect, it } from "vitest";

const CODES: WaitlistFormErrorCode[] = [
  "waitlist.email_invalid",
  "waitlist.consent_required",
  "waitlist.form_invalid",
  "security.rate_limited",
  "security.client_unidentified",
  "core.database_failed",
  "core.unexpected",
];

describe("waitlist messages", () => {
  it.each(["en", "pl"] as const)("have copy in %s for every code the form can show", (locale) => {
    for (const code of CODES) {
      const message = getWaitlistErrorMessage(waitlistMessages[locale], code);
      expect(message, code).not.toBe("");
      expect(message === waitlistMessages[locale].errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getWaitlistErrorMessage(waitlistMessages.en, "waitlist.something_new")).toBe(waitlistMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getWaitlistErrorMessage(waitlistMessages.en, "waitlist.toString")).toBe(waitlistMessages.en.errors.core.unexpected);
  });

  it("are translated, not copied", () => {
    for (const group of ["form", "welcomeMail"] as const) {
      for (const [key, text] of Object.entries(waitlistMessages.en[group])) {
        expect(text, `${group}.${key}`).not.toBe("");
        expect((waitlistMessages.pl[group] as Record<string, string>)[key], `${group}.${key}`).not.toBe(text);
      }
    }
  });
});
