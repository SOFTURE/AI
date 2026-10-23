// API-key and Basic credentials (pasted by an admin, stored sealed like tokens), the app's report that a
// credential was refused, and disconnecting any connection (with a best-effort revocation for OAuth).
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq } from "drizzle-orm";
import type { ConnectionsFlowErrorCode, ConnectionsTokenErrorCode, StoredCredential } from "../contract.js";
import { DEFAULT_ACCOUNT_ID, DEFAULT_CREDENTIAL_HEADER, DEFAULT_CREDENTIAL_SCHEME, type CredentialHeaderPlacement, type ProviderDefinition } from "../options.js";
import { accounts } from "../schema.js";
import { getCredentialContext, sealSecret } from "./crypto.js";
import { findProvider, getConnectionsOptions, readClientCredentials } from "./options.js";
import { findAccount, getKeyring, markReconnectRequired, openApiKey, openBasic, openOAuthSecrets, type ConnectionsContext } from "./store.js";
import { revokeToken } from "./token-client.js";

/** The longest key, username or password the form takes. */
export const MAX_CREDENTIAL_LENGTH = 4096;

export interface ProviderAccountInput {
  readonly provider: string;
  /** One of the provider's `accounts`; `default` when omitted. */
  readonly accountId?: string;
}

export type CredentialInput = { readonly kind: "api_key"; readonly apiKey: string } | { readonly kind: "basic"; readonly username: string; readonly password: string };

export interface SaveCredentialInput extends ProviderAccountInput {
  readonly credential: CredentialInput;
  /** The auth user id of the admin; null for an operator script. */
  readonly actorId: string | null;
}

/** Stores (or replaces) the API key or Basic credential of a provider account, sealed. */
export async function saveCredential(ctx: ConnectionsContext, input: SaveCredentialInput): Promise<Ok<undefined> | Err<ConnectionsFlowErrorCode>> {
  const accountId = input.accountId ?? DEFAULT_ACCOUNT_ID;
  const found = findProvider(ctx.config, input.provider, accountId);
  if (!found.ok) return found;
  const { credential } = input;
  if (found.value.kind !== credential.kind) return err("connections.wrong_kind");
  if (!isCredentialValid(credential)) return err("connections.credential_invalid");
  const keyring = getKeyring(ctx);
  if (!keyring.ok) return keyring;

  const payload = credential.kind === "api_key" ? { apiKey: credential.apiKey.trim() } : { username: credential.username, password: credential.password };
  const sealed = sealSecret(keyring.value, JSON.stringify(payload), getCredentialContext(found.value.id, accountId));
  const now = ctx.clock.now();
  const values = {
    kind: credential.kind,
    status: "connected" as const,
    keyId: sealed.keyId,
    credentials: sealed.sealed,
    tokenType: null,
    scopes: [],
    hasRefreshToken: false,
    expiresAt: null,
    refreshExpiresAt: null,
    connectedAt: now,
    connectedBy: input.actorId,
    refreshedAt: null,
    lastError: null,
    lastErrorAt: null,
    updatedAt: now,
    leaseId: null,
    leaseUntil: null,
  };
  await ctx.db
    .insert(accounts)
    .values({ provider: found.value.id, accountId, ...values })
    .onConflictDoUpdate({ target: [accounts.provider, accounts.accountId], set: values });
  return ok();
}

function isCredentialValid(credential: CredentialInput): boolean {
  if (credential.kind === "api_key") {
    const key = credential.apiKey.trim();
    return key !== "" && key.length <= MAX_CREDENTIAL_LENGTH;
  }
  // RFC 7617: the username cannot hold a colon.
  return (
    credential.username !== "" &&
    !credential.username.includes(":") &&
    credential.username.length <= MAX_CREDENTIAL_LENGTH &&
    credential.password !== "" &&
    credential.password.length <= MAX_CREDENTIAL_LENGTH
  );
}

export type GetCredentialResult = Ok<StoredCredential> | Err<ConnectionsTokenErrorCode>;

/** The stored API key or Basic credential of a provider account. */
export async function getCredential(ctx: ConnectionsContext, input: ProviderAccountInput): Promise<GetCredentialResult> {
  const accountId = input.accountId ?? DEFAULT_ACCOUNT_ID;
  const found = findProvider(ctx.config, input.provider, accountId);
  if (!found.ok) return found;
  const provider = found.value;
  if (provider.kind === "oauth") return err("connections.wrong_kind");
  const keyring = getKeyring(ctx);
  if (!keyring.ok) return keyring;
  const row = await findAccount(ctx, provider.id, accountId);
  if (row === undefined) return err("connections.not_connected");
  if (row.status === "reconnect_required") return err("connections.reconnect_required");
  if (provider.kind === "api_key") {
    const opened = openApiKey(keyring.value, row);
    return opened.ok ? ok({ kind: "api_key", apiKey: opened.value.apiKey }) : opened;
  }
  const opened = openBasic(keyring.value, row);
  return opened.ok ? ok({ kind: "basic", username: opened.value.username, password: opened.value.password }) : opened;
}

/**
 * `Authorization` header value for a stored credential: `Bearer <key>` or `Basic <base64>`. It ignores a provider's
 * `header`; `formatCredentialHeader` and `getCredentialHeader` honour it.
 */
export function getAuthorizationHeader(credential: StoredCredential | { readonly kind: "oauth"; readonly accessToken: string }): string {
  switch (credential.kind) {
    case "api_key":
      return `Bearer ${credential.apiKey}`;
    case "oauth":
      return `Bearer ${credential.accessToken}`;
    case "basic":
      return `Basic ${Buffer.from(`${credential.username}:${credential.password}`, "utf8").toString("base64")}`;
  }
}

/** A header that carries a credential, its name lowercase. */
export interface CredentialHeader {
  readonly name: string;
  readonly value: string;
}

const AUTHORIZATION_BEARER: CredentialHeaderPlacement = { name: DEFAULT_CREDENTIAL_HEADER, scheme: DEFAULT_CREDENTIAL_SCHEME };

/** Where a provider's credential goes: an API key provider's `header`, else `Authorization` (Bearer for a key). */
export function getCredentialPlacement(provider: ProviderDefinition): CredentialHeaderPlacement {
  return provider.kind === "api_key" ? (provider.header ?? AUTHORIZATION_BEARER) : AUTHORIZATION_BEARER;
}

/**
 * The header for a credential. An API key goes where `placement` says (by default `Authorization: Bearer <key>`);
 * Basic and an OAuth token always go in `Authorization`.
 */
export function formatCredentialHeader(
  credential: StoredCredential | { readonly kind: "oauth"; readonly accessToken: string },
  placement: CredentialHeaderPlacement = AUTHORIZATION_BEARER,
): CredentialHeader {
  if (credential.kind !== "api_key") return { name: DEFAULT_CREDENTIAL_HEADER, value: getAuthorizationHeader(credential) };
  return { name: placement.name, value: placement.scheme === null ? credential.apiKey : `${placement.scheme} ${credential.apiKey}` };
}

export type GetCredentialHeaderResult = Ok<CredentialHeader> | Err<ConnectionsTokenErrorCode>;

/** The stored API key or Basic credential of a provider account as the header the provider reads it from. */
export async function getCredentialHeader(ctx: ConnectionsContext, input: ProviderAccountInput): Promise<GetCredentialHeaderResult> {
  const found = findProvider(ctx.config, input.provider, input.accountId ?? DEFAULT_ACCOUNT_ID);
  if (!found.ok) return found;
  const credential = await getCredential(ctx, input);
  return credential.ok ? ok(formatCredentialHeader(credential.value, getCredentialPlacement(found.value))) : credential;
}

/**
 * The app saw the provider refuse a stored credential (a 401 with a key, or with a token that should have
 * been valid): marks the connection `reconnect_required` and runs the hook once. Answers whether it changed.
 */
export async function reportCredentialRejected(ctx: ConnectionsContext, input: ProviderAccountInput): Promise<Ok<boolean> | Err<"connections.unknown_provider" | "connections.not_connected">> {
  const accountId = input.accountId ?? DEFAULT_ACCOUNT_ID;
  const found = findProvider(ctx.config, input.provider, accountId);
  if (!found.ok) return found;
  const row = await findAccount(ctx, found.value.id, accountId);
  if (row === undefined) return err("connections.not_connected");
  return ok(await markReconnectRequired(ctx, { rowId: row.id, provider: row.provider, accountId, kind: row.kind, reason: "rejected" }));
}

export interface DisconnectResult {
  /** Whether a provider revocation endpoint accepted the token; false without one or when it failed. */
  readonly revoked: boolean;
}

/**
 * Deletes a connection. For OAuth with a `revokeUrl`, the refresh token (or the access token) is revoked first,
 * best effort: a failed revocation never keeps the connection.
 */
export async function disconnect(ctx: ConnectionsContext, input: ProviderAccountInput): Promise<Ok<DisconnectResult> | Err<"connections.unknown_provider" | "connections.not_connected">> {
  const accountId = input.accountId ?? DEFAULT_ACCOUNT_ID;
  const found = findProvider(ctx.config, input.provider, accountId);
  if (!found.ok) return found;
  const provider = found.value;
  const [deleted] = await ctx.db
    .delete(accounts)
    .where(and(eq(accounts.provider, provider.id), eq(accounts.accountId, accountId)))
    .returning();
  if (deleted === undefined) return err("connections.not_connected");
  if (provider.kind !== "oauth" || provider.revokeUrl === undefined) return ok({ revoked: false });

  const keyring = getKeyring(ctx);
  const client = readClientCredentials(provider, ctx.env);
  const secrets = keyring.ok ? openOAuthSecrets(keyring.value, deleted) : keyring;
  if (!client.ok || !secrets.ok) return ok({ revoked: false });
  const options = getConnectionsOptions(ctx.config);
  const token = secrets.value.refreshToken ?? secrets.value.accessToken;
  const revoked = await revokeToken({
    provider,
    revokeUrl: provider.revokeUrl,
    client: client.value,
    params: { token, token_type_hint: secrets.value.refreshToken === null ? "access_token" : "refresh_token" },
    fetch: options.fetch ?? globalThis.fetch,
    timeoutMs: options.httpTimeoutMs,
  });
  return ok({ revoked });
}
