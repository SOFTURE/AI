import { billingMessages, getBillingErrorMessage, type BillingFormErrorCode } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

const CODES: BillingFormErrorCode[] = ["billing.read_only", "billing.account_unknown", "billing.end_not_in_future", "core.database_failed", "core.unexpected"];

describe("billing messages", () => {
  it.each(["en", "pl"] as const)("have copy in %s for every code a guarded write can show", (locale) => {
    for (const code of CODES) {
      const message = getBillingErrorMessage(billingMessages[locale], code);
      expect(message, code).not.toBe("");
      expect(message === billingMessages[locale].errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getBillingErrorMessage(billingMessages.en, "billing.something_new")).toBe(billingMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getBillingErrorMessage(billingMessages.en, "billing.toString")).toBe(billingMessages.en.errors.core.unexpected);
  });

  it("are translated, not copied", () => {
    for (const group of ["badge", "notice"] as const) {
      for (const [key, text] of Object.entries(billingMessages.en[group])) {
        expect(text, `${group}.${key}`).not.toEqual("");
        expect((billingMessages.pl[group] as Record<string, unknown>)[key], `${group}.${key}`).not.toEqual(text);
      }
    }
  });
});
