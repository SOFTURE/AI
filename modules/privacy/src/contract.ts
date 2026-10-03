// Result types and error codes of the privacy module. No user-facing copy here: the UI translates
// codes through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode } from "@softure-ai/core";

export type PrivacyErrorCode =
  | "privacy.export_failed"
  | "privacy.export_too_large"
  | "privacy.deletion_refused"
  | "privacy.password_invalid"
  | "privacy.confirmation_required";

/** The file a user downloads: every contributor's part under its id. */
export interface PrivacyExport {
  readonly format: "softure.privacy-export";
  readonly version: 1;
  readonly userId: string;
  /** ISO 8601, UTC. */
  readonly exportedAt: string;
  /** Each contributor's data under its id (a module id or an app contributor id), in export order. */
  readonly data: Readonly<Record<string, unknown>>;
}

/** Every code the delete form can show: its own, the session and rate limit refusals, the generic ones. */
export type DeleteAccountErrorCode =
  | Extract<PrivacyErrorCode, "privacy.deletion_refused" | "privacy.password_invalid" | "privacy.confirmation_required">
  | "auth.unauthenticated"
  | "security.rate_limited"
  | CoreErrorCode;

export type DeleteAccountField = "password" | "confirm";

/** What the delete action returns to its form (`useActionState`); success redirects instead. */
export interface DeleteAccountFormState {
  readonly status: "idle" | "error";
  readonly error?: DeleteAccountErrorCode;
  /** The field the error belongs to; none for a form-level error. */
  readonly field?: DeleteAccountField;
}

export const INITIAL_DELETE_ACCOUNT_STATE: DeleteAccountFormState = { status: "idle" };
