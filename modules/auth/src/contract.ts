// Result types and error codes of the auth module. No user-facing copy here: the UI translates
// codes through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode } from "@softure-ai/core";
import type { SecurityErrorCode } from "@softure-ai/security";

export type AuthErrorCode =
  | "auth.invalid_credentials"
  | "auth.email_invalid"
  | "auth.email_taken"
  | "auth.password_too_short"
  | "auth.password_too_long"
  | "auth.consent_required"
  | "auth.registration_closed"
  | "auth.current_password_invalid"
  | "auth.unauthenticated";

/** Every code an auth form can show: its own, the rate limiter's and the generic ones. */
export type AuthFormErrorCode = AuthErrorCode | Extract<SecurityErrorCode, "security.rate_limited" | "security.client_unidentified"> | CoreErrorCode;

/** A signed-up account, as the app sees it. The password hash never leaves the module. */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly createdAt: Date;
}

/** A session just opened: the token goes into the cookie and is never stored. */
export interface NewSession {
  readonly token: string;
  readonly expiresAt: Date;
}

/** A successful register or login. */
export interface SignedIn {
  readonly user: AuthUser;
  readonly session: NewSession;
}

/** What `onRegistered` receives. `consent` is null when the app turned `requireConsent` off. */
export interface RegisteredEvent {
  readonly user: AuthUser;
  readonly consent: { readonly acceptedAt: Date } | null;
}

/** The fields of the auth forms that can carry their own error. */
export type AuthFormField = "email" | "password" | "currentPassword" | "newPassword" | "consent";

/**
 * What an auth server action returns to its form (`useActionState`). A successful login or
 * register redirects instead of returning; a password change returns `ok`.
 */
export interface AuthFormState {
  readonly status: "idle" | "ok" | "error";
  /** The error to show; when `field` is set it is shown at that field. */
  readonly error?: AuthFormErrorCode;
  readonly field?: AuthFormField;
  /** The submitted email, so a rejected form keeps it (passwords are never sent back). */
  readonly email?: string;
}

export const INITIAL_AUTH_FORM_STATE: AuthFormState = { status: "idle" };
