import { billingMessages, getBillingErrorMessage, type AdminActionErrorCode, type BillingFormErrorCode, type GrantFormErrorCode, type PaymentFormErrorCode, type UsageErrorCode } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

const CODES: (BillingFormErrorCode | PaymentFormErrorCode | GrantFormErrorCode | AdminActionErrorCode | UsageErrorCode)[] = [
  "billing.read_only",
  "billing.account_unknown",
  "billing.end_not_in_future",
  "billing.plan_unknown",
  "billing.invoice_details_invalid",
  "billing.payment_failed",
  "billing.lifetime_active",
  "billing.request_closed",
  "billing.grant_revoked",
  "billing.quota_exhausted",
  "security.rate_limited",
  "auth.forbidden",
  "core.database_failed",
  "core.unexpected",
];

/** Every string of a dictionary group, by its dotted path. */
function flatten(tree: unknown, path = ""): [string, string][] {
  if (typeof tree === "string") return [[path, tree]];
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) => flatten(value, path === "" ? key : `${path}.${key}`));
}

describe("billing messages", () => {
  it("have English copy for every code a guarded write or a billing form can show", () => {
    for (const code of CODES) {
      const message = getBillingErrorMessage(billingMessages.en, code);
      expect(message, code).not.toBe("");
      expect(message === billingMessages.en.errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getBillingErrorMessage(billingMessages.en, "billing.something_new")).toBe(billingMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getBillingErrorMessage(billingMessages.en, "billing.toString")).toBe(billingMessages.en.errors.core.unexpected);
  });

  it("ship English as the only built-in language, with no empty string", () => {
    expect(Object.keys(billingMessages)).toEqual(["en"]);
    for (const [path, text] of flatten(billingMessages.en)) {
      expect(text, path).not.toEqual("");
    }
  });
});
