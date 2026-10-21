// Result types and error codes of the connections module. No user-facing copy here: the UI translates codes
// through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode } from "@softure-ai/core";

/** The keyring cannot seal or open a secret: a configuration problem, never fixed by retrying. */
export type ConnectionsKeyErrorCode =
  /** `SOFTURE_CONNECTIONS_KEYS` is not set. */
  | "connections.key_missing"
  /** `SOFTURE_CONNECTIONS_KEYS` is set but is not a list of `<id>:<base64 32 bytes>`. */
  | "connections.key_invalid"
  /** The secret was sealed with a key id the keyring no longer holds. */
  | "connections.key_unknown"
  /** The ciphertext does not open with its key (tampered, or moved to another row). */
  | "connections.secret_unreadable";

/** Why `getAccessToken` or `getCredential` could not answer. */
export type ConnectionsTokenErrorCode =
  | ConnectionsKeyErrorCode
  /** The provider id is not declared in `connections({ providers })`, or the account is not one of its accounts. */
  | "connections.unknown_provider"
  /** The call does not fit the provider's kind: a token for an API key provider, or the other way round. */
  | "connections.wrong_kind"
  /** Nothing is stored for this provider and account. */
  | "connections.not_connected"
  /** Terminal: the grant or the key is gone (revoked, expired, rejected); only a new connect fixes it. */
  | "connections.reconnect_required"
  /** Retryable: the token endpoint was unreachable, rate limited, down or answered something unexpected. */
  | "connections.refresh_failed"
  /** Retryable: another worker is refreshing this connection and did not finish in time. */
  | "connections.refresh_in_progress"
  /** The provider refused the app's client id or secret (`invalid_client`); fix the configuration. */
  | "connections.client_rejected"
  /** The provider's client id or secret variable is not set. */
  | "connections.provider_not_configured";

/** Why a connect flow, a key form or a disconnect failed. */
export type ConnectionsFlowErrorCode =
  | ConnectionsKeyErrorCode
  | "connections.unknown_provider"
  | "connections.wrong_kind"
  | "connections.provider_not_configured"
  | "connections.client_rejected"
  /** The callback's state is unknown, used, expired or was started by another user. */
  | "connections.state_invalid"
  /** The user declined the consent screen (`error=access_denied`). */
  | "connections.consent_denied"
  /** The provider sent the user back with another error, or without a code. */
  | "connections.authorization_failed"
  /** Exchanging the code for tokens failed. */
  | "connections.exchange_failed"
  /** The key form was empty or too long. */
  | "connections.credential_invalid"
  | "connections.not_connected";

export type ConnectionsErrorCode = ConnectionsTokenErrorCode | ConnectionsFlowErrorCode;

/** Every code the page can show: the module's own, the role refusal and the generic ones. */
export type ConnectionsFormErrorCode = ConnectionsErrorCode | "auth.forbidden" | CoreErrorCode;

/** The kinds of credential a provider can have. */
export type ConnectionKind = "oauth" | "api_key" | "basic";

/**
 * A connection's health as the page shows it:
 * - `connected`: usable;
 * - `expiring`: usable, but its refresh token (or, without one, its access token) dies within `expiringWithinHours`;
 * - `reconnect_required`: unusable until an admin connects it again;
 * - `not_connected`: nothing stored.
 */
export type ConnectionStatus = "connected" | "expiring" | "reconnect_required" | "not_connected";

/** One provider account as the page and the app see it. Never carries a secret. */
export interface ConnectionView {
  readonly provider: string;
  readonly accountId: string;
  readonly kind: ConnectionKind;
  /** The provider's label in the app's locale. */
  readonly label: string;
  readonly status: ConnectionStatus;
  readonly scopes: readonly string[];
  readonly expiresAt: Date | null;
  readonly refreshExpiresAt: Date | null;
  readonly connectedAt: Date | null;
  readonly connectedBy: string | null;
  readonly refreshedAt: Date | null;
  readonly lastError: string | null;
  readonly lastErrorAt: Date | null;
}

/** An access token ready for an `Authorization` header. */
export interface AccessToken {
  readonly accessToken: string;
  /** As the provider named it (`Bearer`, `bearer`); send `Bearer` unless its API says otherwise. */
  readonly tokenType: string;
  readonly expiresAt: Date | null;
  readonly scopes: readonly string[];
}

/** A stored API key or Basic credential. */
export type StoredCredential =
  | { readonly kind: "api_key"; readonly apiKey: string }
  | { readonly kind: "basic"; readonly username: string; readonly password: string };

/** Why a connection needs reconnecting, as the hook receives it. */
export type ReconnectReason =
  /** The provider answered `invalid_grant` to a refresh. */
  | "invalid_grant"
  /** The access token expired and there is no refresh token. */
  | "expired"
  /** The app reported the credential rejected (`reportCredentialRejected`, e.g. after a 401). */
  | "rejected";

/** What `onReconnectRequired` receives. */
export interface ReconnectRequiredEvent {
  readonly provider: string;
  readonly accountId: string;
  readonly kind: ConnectionKind;
  readonly reason: ReconnectReason;
  readonly at: Date;
}

/** What the page's key form and disconnect actions return (`useActionState`). */
export interface ConnectionFormState {
  readonly status: "idle" | "ok" | "error";
  readonly error?: ConnectionsFormErrorCode;
}
