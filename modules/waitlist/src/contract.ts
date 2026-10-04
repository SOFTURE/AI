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

/** Why a confirmation link was refused. */
export type WaitlistConfirmationErrorCode =
  /** Missing, malformed, or replaced by a newer link. */
  | "waitlist.confirmation_invalid"
  /** Past its expiry; signing up again sends a new one. */
  | "waitlist.confirmation_expired";

/** Every code the form can show: its own, the client and rate limit refusals, the generic ones. */
export type WaitlistFormErrorCode = WaitlistErrorCode | "security.rate_limited" | "security.client_unidentified" | CoreErrorCode;

export type WaitlistFormField = "email" | "consent";

/** What the join action returns to its form (`useActionState`). */
export interface WaitlistFormState {
  /** `ok`: the sign-up counts; `confirmation_sent`: it waits for the link mailed to the address. */
  readonly status: "idle" | "ok" | "confirmation_sent" | "error";
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
  /** When it first counted; null while its first request waits for the confirmation link. */
  readonly confirmedAt: Date | null;
}

/** What `onJoined` receives: a sign-up that counts for the first time, and how it came to count. */
export interface WaitlistJoinedEvent {
  readonly signup: WaitlistSignup;
  /** `join`: applied when it was made (no double opt-in); `confirmation`: its link was used. */
  readonly via: "join" | "confirmation";
}
