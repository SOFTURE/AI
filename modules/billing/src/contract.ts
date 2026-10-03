// Result types and error codes of the billing module. No user-facing copy here: the UI translates
// codes through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode, Locale } from "@softure-ai/core";

export type BillingErrorCode =
  /** The account may read but not write: its trial or its paid access ended. */
  | "billing.read_only"
  /** No account has this id. */
  | "billing.account_unknown"
  /** A grant or a trial extension that ends now or earlier. */
  | "billing.end_not_in_future";

/** Every code a guarded write can show: the guard's own and the generic ones. */
export type BillingFormErrorCode = BillingErrorCode | CoreErrorCode;

export const ENTITLEMENT_STATUSES = ["trial", "paid", "read_only"] as const;

export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

/** What is stored per account (or derived for an account without a row). */
export interface EntitlementRecord {
  /** The first instant the trial no longer covers. */
  readonly trialEndsAt: Date;
  /**
   * The first instant dated paid access no longer covers; null when never paid or revoked. Kept
   * under lifetime access, so a refunded lifetime falls back to the periods bought beside it.
   */
  readonly paidUntil: Date | null;
  /** Paid access without an end; it wins over `paidUntil`. */
  readonly isLifetime: boolean;
}

/** Where an account stands at one instant: the state machine's answer. */
export type Entitlement =
  | {
      readonly status: "trial";
      readonly endsAt: Date;
      /** Calendar days of access left in the app's time zone, today included. */
      readonly daysLeft: number;
      /** Inside the trial reminder window: time to show the notice. */
      readonly isEnding: boolean;
    }
  | {
      readonly status: "paid";
      /** Null for lifetime access. */
      readonly endsAt: Date | null;
      /** Null for lifetime access. */
      readonly daysLeft: number | null;
      /** Inside the paid reminder window; never for lifetime access. */
      readonly isEnding: boolean;
    }
  | {
      readonly status: "read_only";
      /** When write access ended. */
      readonly since: Date;
      /** Which access ended last. */
      readonly reason: "trial_ended" | "paid_ended";
    };

/** A change to an account's entitlement, applied by `changeEntitlement`. */
export type EntitlementEvent =
  /** Paid access until `until`; never shortens a later end already granted. */
  | { readonly type: "grant"; readonly until: Date }
  /** Paid access without an end; the dated end stays beside it. */
  | { readonly type: "grant_lifetime" }
  /** Removes all paid access (a mistaken grant), lifetime included; the trial stays as it was. */
  | { readonly type: "revoke" }
  /**
   * Moves dated paid access back to end at `until` (a refunded period); never lengthens it. An end
   * at or before the trial's end drops dated paid access: the account is back on its trial.
   */
  | { readonly type: "shorten"; readonly until: Date }
  /** Ends lifetime access (a refunded lifetime); dated paid access stays. */
  | { readonly type: "end_lifetime" }
  /** Moves the trial end to `until`; never shortens it. */
  | { readonly type: "extend_trial"; readonly until: Date };

/** What one payment of a plan added to an account, stored with the payment so a refund takes back only that. */
export type PaymentGrant =
  /** A paid period from where access ended (or the payment's instant) to the period's end. */
  | { readonly kind: "period"; readonly from: Date; readonly until: Date }
  | { readonly kind: "lifetime" };

/** Copy per locale; a locale without its own text falls back to `en`. */
export type LocalizedText = Readonly<Partial<Record<Locale, string>>>;

export const PERIOD_UNITS = ["day", "week", "month", "year"] as const;

export type PeriodUnit = (typeof PERIOD_UNITS)[number];

/** How long one payment of a plan gives access: `count` units, or for good. */
export type PlanPeriod = { readonly unit: PeriodUnit; readonly count: number } | { readonly unit: "lifetime" };

/** A price in the currency's minor unit (cents, grosze; whole yen for JPY), as payment providers take it. */
export interface PlanPrice {
  readonly amount: number;
  /** ISO 4217, upper case, e.g. `PLN`, `EUR`. */
  readonly currency: string;
}

/** A plan from `billing({ plans })`. */
export interface Plan {
  /** Kebab-case, unique; the payment page and the payment providers name the plan by it. */
  readonly id: string;
  readonly name: LocalizedText;
  readonly description?: LocalizedText;
  readonly price: PlanPrice;
  readonly period: PlanPeriod;
  /** What the plan includes, one line each, in the order the tile lists them. */
  readonly features: readonly LocalizedText[];
  /** Drawn as the recommended plan. */
  readonly isFeatured: boolean;
}

/** Why a payment could not start. */
export type PaymentErrorCode =
  /** A plan id the config does not declare: a tampered or outdated form. */
  | "billing.plan_unknown"
  /** The invoice details are missing or too long; `fieldErrors` says which. */
  | "billing.invoice_details_invalid"
  /** The payment provider refused or failed; nothing was charged or requested. */
  | "billing.payment_failed";

/** Every code the payment form can show. */
export type PaymentFormErrorCode = PaymentErrorCode | "security.rate_limited" | CoreErrorCode;

/** Every code the admin grant form can show. */
export type GrantFormErrorCode = "billing.plan_unknown" | "billing.account_unknown" | "auth.forbidden" | CoreErrorCode;

/** What the payment action returns to its form (`useActionState`). */
export interface PaymentFormState {
  readonly status: "idle" | "requested" | "error";
  readonly error?: PaymentFormErrorCode;
  /** Errors of single invoice fields, by field name. */
  readonly fieldErrors?: Readonly<Record<string, PaymentFormErrorCode>>;
  /** The invoice details as typed, to fill the fields again after an error. */
  readonly values?: Readonly<Record<string, string>>;
}

export const INITIAL_PAYMENT_FORM_STATE: PaymentFormState = { status: "idle" };

/** What the admin grant action returns to its form (`useActionState`). */
export interface GrantFormState {
  readonly status: "idle" | "granted" | "error";
  readonly error?: GrantFormErrorCode;
  /** After a grant: what the account has now, in the app's copy. */
  readonly notice?: string;
  /** The email and plan as sent, to fill the form again after an error. */
  readonly email?: string;
  readonly planId?: string;
}

export const INITIAL_GRANT_FORM_STATE: GrantFormState = { status: "idle" };
