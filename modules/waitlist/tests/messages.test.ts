import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { getWaitlistErrorMessage, waitlistMessages, type WaitlistFormErrorCode } from "@softure-ai/waitlist";
import { getWaitlistMessages, getWaitlistMessagesIn } from "@softure-ai/waitlist/server";
import { describe, expect, it } from "vitest";
import { createConfig, OPTIONS } from "./support.js";

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
  it("have English copy for every code the form can show", () => {
    for (const code of CODES) {
      const message = getWaitlistErrorMessage(waitlistMessages.en, code);
      expect(message, code).not.toBe("");
      expect(message === waitlistMessages.en.errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getWaitlistErrorMessage(waitlistMessages.en, "waitlist.something_new")).toBe(waitlistMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getWaitlistErrorMessage(waitlistMessages.en, "waitlist.toString")).toBe(waitlistMessages.en.errors.core.unexpected);
  });

  it("ship English as the only built-in language, with every mail and form text", () => {
    expect(Object.keys(waitlistMessages)).toEqual(["en"]);
    for (const group of ["form", "welcomeMail", "confirmationMail"] as const) {
      for (const [key, text] of Object.entries(waitlistMessages.en[group])) {
        expect(text, `${group}.${key}`).not.toBe("");
      }
    }
  });
});

describe("getWaitlistMessagesIn", () => {
  const GERMAN = { welcomeMail: { subject: "Willkommen auf der Liste" } };
  const config = createConfig(fakeMailProvider(), { locale: "de", waitlist: { ...OPTIONS, messages: { de: GERMAN } } });

  it("reads the app's translation in the app's locale, English where it leaves a key out", () => {
    const messages = getWaitlistMessages(config);
    expect(messages.welcomeMail.subject).toBe("Willkommen auf der Liste");
    expect(messages.welcomeMail.text).toBe(waitlistMessages.en.welcomeMail.text);
  });

  it("writes in a stored locale the module has copy in", () => {
    expect(getWaitlistMessagesIn(config, "en").welcomeMail.subject).toBe(waitlistMessages.en.welcomeMail.subject);
    expect(getWaitlistMessagesIn(config, "de").welcomeMail.subject).toBe("Willkommen auf der Liste");
  });

  it("falls back to the app's locale for a stored locale without copy, or one that is not a language tag", () => {
    expect(getWaitlistMessagesIn(config, "fr").welcomeMail.subject).toBe("Willkommen auf der Liste");
    expect(getWaitlistMessagesIn(config, "not a tag").welcomeMail.subject).toBe("Willkommen auf der Liste");
  });
});
