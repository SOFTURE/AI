// A user's grant at rest: sealed with AES-256-GCM under the app's keyring, bound to the user and the provider (and,
// when a user keeps several grants there, the connection's name), so a value copied to another user's row does not
// open. The keyring is the app's choice: `readKeyring` reads `SOFTURE_CONNECTIONS_KEYS` by default, or any variable
// in the same format.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { openSecret, sealSecret, type Keyring } from "../server/crypto.js";

/** Whose grant a sealed value is. */
export interface UserSecretOwner {
  /** The app's user id. */
  readonly userId: string;
  /** The provider id (`dropbox`). */
  readonly provider: string;
  /** Which of the user's connections there, when the app keeps more than one per provider. */
  readonly name?: string;
}

const MAX_SECRET_LENGTH = 32_768;

/** Seals a secret (a refresh token, or JSON of several) for one user's connection. */
export function sealUserSecret(keyring: Keyring, owner: UserSecretOwner, secret: string): string {
  return sealSecret(keyring, secret, getUserSecretContext(owner)).sealed;
}

export type OpenUserSecretResult = Ok<string> | Err<"connections.key_unknown" | "connections.secret_unreadable">;

/** Opens a value `sealUserSecret` sealed for the same owner; anything else is `connections.secret_unreadable`. */
export function openUserSecret(keyring: Keyring, owner: UserSecretOwner, sealed: string): OpenUserSecretResult {
  const opened = openSecret(keyring, sealed, getUserSecretContext(owner));
  if (!opened.ok) return opened;
  if (opened.value === "" || opened.value.length > MAX_SECRET_LENGTH) return err("connections.secret_unreadable");
  return ok(opened.value);
}

function getUserSecretContext(owner: UserSecretOwner): string {
  const parts = [owner.userId, owner.provider, ...(owner.name === undefined ? [] : [owner.name])];
  return `connections/users/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}
