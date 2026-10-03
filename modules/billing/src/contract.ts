// Result types and error codes of the billing module. No user-facing copy here: the UI translates
// codes through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode } from "@softure-ai/core";

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
  /** The first instant paid access no longer covers; null when never paid or revoked. */
  readonly paidUntil: Date | null;
  /** Paid access without an end. `paidUntil` is then null. */
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
  /** Paid access without an end. */
  | { readonly type: "grant_lifetime" }
  /** Removes paid access (a refund, a mistaken grant); the trial stays as it was. */
  | { readonly type: "revoke" }
  /** Moves the trial end to `until`; never shortens it. */
  | { readonly type: "extend_trial"; readonly until: Date };
