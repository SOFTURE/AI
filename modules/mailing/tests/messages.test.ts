import { getMailingErrorMessage, mailingMessages, type MailingErrorCode } from "@softure-ai/mailing";
import { describe, expect, it } from "vitest";

const CODES: MailingErrorCode[] = ["mailing.invalid_input", "mailing.rejected", "mailing.unavailable"];

describe("mailing messages", () => {
  it.each(["en", "pl"] as const)("have distinct copy in %s for every error code", (locale) => {
    const copy = CODES.map((code) => getMailingErrorMessage(mailingMessages[locale], code));
    expect(copy.every((message) => message !== "")).toBe(true);
    expect(new Set(copy).size).toBe(CODES.length);
  });

  it("read an unknown code as unavailable", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getMailingErrorMessage(mailingMessages.en, "mailing.something_new")).toBe(mailingMessages.en.errors.mailing.unavailable);
    // @ts-expect-error: an inherited property is not a message.
    expect(getMailingErrorMessage(mailingMessages.en, "mailing.toString")).toBe(mailingMessages.en.errors.mailing.unavailable);
  });

  it("are translated, not copied", () => {
    expect(mailingMessages.pl.errors.mailing.rejected).not.toBe(mailingMessages.en.errors.mailing.rejected);
  });
});
