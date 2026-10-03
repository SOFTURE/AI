// Result types and error codes of the waitlist module. No user-facing copy here: the UI translates
// codes through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode } from "@softure-ai/core";

export type WaitlistErrorCode =
  /** Not an email address (or longer than 254 characters). */
  | "waitlist.email_invalid"
  /** A required scope was not checked, or no scope at all. */
  | "waitlist.consent_required"
  /** A scope or placement the config does not declare: a tampered or outdated form. */
  | "waitlist.form_invalid";

/** Every code the form can show: its own, the client and rate limit refusals, the generic ones. */
export type WaitlistFormErrorCode = WaitlistErrorCode | "security.rate_limited" | "security.client_unidentified" | CoreErrorCode;

export type WaitlistFormField = "email" | "consent";

/** What the join action returns to its form (`useActionState`). */
export interface WaitlistFormState {
  readonly status: "idle" | "ok" | "error";
  readonly error?: WaitlistFormErrorCode;
  /** The field the error belongs to; none for a form-level error. */
  readonly field?: WaitlistFormField;
  /** The email as typed, to fill the field again after an error. */
  readonly email?: string;
  /** The scopes checked, to check them again after an error. */
  readonly scopes?: readonly string[];
}

export const INITIAL_WAITLIST_FORM_STATE: WaitlistFormState = { status: "idle" };

/** One sign-up as the module returns it. */
export interface WaitlistSignup {
  readonly id: string;
  /** Trimmed and lowercased. */
  readonly email: string;
  /** Granted scopes, in the config's order. */
  readonly scopes: readonly string[];
  /** The placement of the first sign-up. */
  readonly placement: string;
  /** The app's locale at the first sign-up. */
  readonly locale: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
