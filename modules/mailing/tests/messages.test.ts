import { getMailingErrorMessage, mailingMessages, type DeliveryJobErrorCode, type MailingErrorCode } from "@softure-ai/mailing";
import { describe, expect, it } from "vitest";

const CODES: (MailingErrorCode | DeliveryJobErrorCode)[] = [
  "mailing.invalid_input",
  "mailing.rejected",
  "mailing.unavailable",
  "mailing.suppressed",
  "mailing.provider_refused",
  "mailing.quota_exceeded",
  "mailing.delivery_in_flight",
  "mailing.delivery_uncertain",
];

describe("mailing messages", () => {
  it("have distinct English copy for every error code", () => {
    const copy = CODES.map((code) => getMailingErrorMessage(mailingMessages.en, code));
    expect(copy.every((message) => message !== "")).toBe(true);
    expect(new Set(copy).size).toBe(CODES.length);
  });

  it("read an unknown code as unavailable", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getMailingErrorMessage(mailingMessages.en, "mailing.something_new")).toBe(mailingMessages.en.errors.mailing.unavailable);
    // @ts-expect-error: an inherited property is not a message.
    expect(getMailingErrorMessage(mailingMessages.en, "mailing.toString")).toBe(mailingMessages.en.errors.mailing.unavailable);
  });

  it("ship English as the only built-in language", () => {
    expect(Object.keys(mailingMessages)).toEqual(["en"]);
  });

  it("have every footer and page text", () => {
    const { footer, unsubscribe } = mailingMessages.en;
    expect([...Object.values(footer), ...Object.values(unsubscribe)].every((text) => text.trim() !== "")).toBe(true);
  });
});
