import { authMessages, getAuthErrorMessage, type AuthFormErrorCode } from "@softure-ai/auth";
import { describe, expect, it } from "vitest";

const CODES: AuthFormErrorCode[] = [
  "auth.invalid_credentials",
  "auth.email_invalid",
  "auth.email_taken",
  "auth.password_too_short",
  "auth.password_too_long",
  "auth.consent_required",
  "auth.registration_closed",
  "auth.current_password_invalid",
  "auth.unauthenticated",
  "auth.forbidden",
  "auth.reset_token_invalid",
  "auth.password_reset_unavailable",
  "security.rate_limited",
  "security.client_unidentified",
  "core.database_failed",
  "core.unexpected",
];

describe("auth messages", () => {
  it.each(["en", "pl"] as const)("have copy in %s for every code a form can show", (locale) => {
    for (const code of CODES) {
      const message = getAuthErrorMessage(authMessages[locale], code);
      expect(message, code).not.toBe("");
      expect(message === authMessages[locale].errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("look up a code by its namespace and name", () => {
    expect(getAuthErrorMessage(authMessages.en, "auth.email_taken")).toBe("An account with this email already exists.");
    expect(getAuthErrorMessage(authMessages.en, "security.rate_limited")).toBe("Too many attempts. Wait a few minutes and try again.");
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getAuthErrorMessage(authMessages.en, "auth.something_new")).toBe(authMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getAuthErrorMessage(authMessages.en, "auth.toString")).toBe(authMessages.en.errors.core.unexpected);
  });

  it("are translated, not copied", () => {
    expect(authMessages.pl.login.title).not.toBe(authMessages.en.login.title);
  });
});
