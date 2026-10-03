import { billingMessages, getBillingErrorMessage, type BillingFormErrorCode, type GrantFormErrorCode, type PaymentFormErrorCode } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

const CODES: (BillingFormErrorCode | PaymentFormErrorCode | GrantFormErrorCode)[] = [
  "billing.read_only",
  "billing.account_unknown",
  "billing.end_not_in_future",
  "billing.plan_unknown",
  "billing.invoice_details_invalid",
  "billing.payment_failed",
  "security.rate_limited",
  "auth.forbidden",
  "core.database_failed",
  "core.unexpected",
];

const SAME_IN_BOTH = new Set(["admin.plan", "payment.orderLead"]);

/** Every string of a dictionary group, by its dotted path. */
function flatten(tree: unknown, path = ""): [string, string][] {
  if (typeof tree === "string") return [[path, tree]];
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) => flatten(value, path === "" ? key : `${path}.${key}`));
}

describe("billing messages", () => {
  it.each(["en", "pl"] as const)("have copy in %s for every code a guarded write or a billing form can show", (locale) => {
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
    const polish = new Map(flatten(billingMessages.pl));
    for (const [path, text] of flatten(billingMessages.en)) {
      expect(text, path).not.toEqual("");
      // Words that are the same in both languages, and a line made only of placeholders.
      if (SAME_IN_BOTH.has(path)) continue;
      expect(polish.get(path), path).not.toEqual(text);
    }
  });
});
