import { getMailingErrorMessage, mailingMessages, type MailingErrorCode } from "@softure-ai/mailing";
import { describe, expect, it } from "vitest";

const CODES: MailingErrorCode[] = ["mailing.invalid_input", "mailing.rejected", "mailing.unavailable", "mailing.suppressed"];

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
    expect(mailingMessages.pl.footer.text).not.toBe(mailingMessages.en.footer.text);
    expect(mailingMessages.pl.unsubscribe.submit).not.toBe(mailingMessages.en.unsubscribe.submit);
  });

  it("have every footer and page text in both languages", () => {
    const keys = (tree: object): string[] =>
      Object.entries(tree).flatMap(([key, value]) => (typeof value === "string" ? [key] : keys(value as object).map((child) => `${key}.${child}`)));
    expect(keys(mailingMessages.pl)).toEqual(keys(mailingMessages.en));
    for (const locale of ["en", "pl"] as const) {
      const { footer, unsubscribe } = mailingMessages[locale];
      expect([...Object.values(footer), ...Object.values(unsubscribe)].every((text) => text.trim() !== "")).toBe(true);
    }
  });
});
