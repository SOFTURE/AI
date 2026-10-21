// Reading and writing connection rows: the sealed credential payloads, the transition to
// `reconnect_required` (with the app's hook, once per transition) and the module context type.
import { errorLogLabel, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ConnectionKind, ConnectionsKeyErrorCode, ReconnectReason } from "../contract.js";
import { accounts, type AccountRow } from "../schema.js";
import { getCredentialContext, openSecret, readKeyring, type Env, type Keyring } from "./crypto.js";
import { getConnectionsOptions } from "./options.js";

/** What every server function receives. `env` defaults to `process.env` (the keyring and client secrets). */
export interface ConnectionsContext extends ModuleContext<Queryable> {
  readonly env?: Env;
}

/** The sealed payload of an OAuth connection. */
export interface OAuthSecrets {
  readonly accessToken: string;
  readonly refreshToken: string | null;
}

const oauthSecretsSchema = z.strictObject({ accessToken: z.string().min(1), refreshToken: z.string().min(1).nullable() });
const apiKeySchema = z.strictObject({ apiKey: z.string().min(1) });
const basicSchema = z.strictObject({ username: z.string(), password: z.string() });

export type KeyringLookup = Ok<Keyring> | Err<"connections.key_missing" | "connections.key_invalid">;

export function getKeyring(ctx: ConnectionsContext): KeyringLookup {
  return readKeyring(ctx.env ?? process.env);
}

export async function findAccount(ctx: ConnectionsContext, provider: string, accountId: string): Promise<AccountRow | undefined> {
  const [row] = await ctx.db
    .select()
    .from(accounts)
    .where(and(eq(accounts.provider, provider), eq(accounts.accountId, accountId)));
  return row;
}

/** Opens a row's sealed payload as JSON of the given shape; a shape mismatch reads as unreadable. */
function openPayload<T>(keyring: Keyring, row: AccountRow, schema: z.ZodType<T>): Ok<T> | Err<ConnectionsKeyErrorCode> {
  const opened = openSecret(keyring, row.credentials, getCredentialContext(row.provider, row.accountId));
  if (!opened.ok) return opened;
  let value: unknown;
  try {
    value = JSON.parse(opened.value);
  } catch {
    return { ok: false, error: "connections.secret_unreadable" };
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? ok(parsed.data) : { ok: false, error: "connections.secret_unreadable" };
}

export function openOAuthSecrets(keyring: Keyring, row: AccountRow): Ok<OAuthSecrets> | Err<ConnectionsKeyErrorCode> {
  return openPayload(keyring, row, oauthSecretsSchema);
}

export function openApiKey(keyring: Keyring, row: AccountRow): Ok<{ apiKey: string }> | Err<ConnectionsKeyErrorCode> {
  return openPayload(keyring, row, apiKeySchema);
}

export function openBasic(keyring: Keyring, row: AccountRow): Ok<{ username: string; password: string }> | Err<ConnectionsKeyErrorCode> {
  return openPayload(keyring, row, basicSchema);
}

/** Opens any row's payload as its plain JSON text, for re-sealing under a new key. */
export function openPayloadText(keyring: Keyring, row: AccountRow) {
  return openSecret(keyring, row.credentials, getCredentialContext(row.provider, row.accountId));
}

export interface MarkReconnectInput {
  readonly rowId: string;
  readonly provider: string;
  readonly accountId: string;
  readonly kind: ConnectionKind;
  readonly reason: ReconnectReason;
  /** Releases this refresh lease afterwards. */
  readonly leaseId?: string;
}

/**
 * Stores `reconnect_required` for a connected row and runs the app's `onReconnectRequired` hook when this call
 * made the transition. Answers whether it did. A hook failure is logged by kind and never thrown: the state is
 * stored either way.
 */
export async function markReconnectRequired(ctx: ConnectionsContext, input: MarkReconnectInput): Promise<boolean> {
  const now = ctx.clock.now();
  const changed = await ctx.db
    .update(accounts)
    .set({ status: "reconnect_required", lastError: "connections.reconnect_required", lastErrorAt: now, updatedAt: now })
    .where(and(eq(accounts.id, input.rowId), eq(accounts.status, "connected")))
    .returning({ id: accounts.id });
  if (input.leaseId !== undefined) await releaseLease(ctx, input.rowId, input.leaseId);
  if (changed.length === 0) return false;
  const hook = getConnectionsOptions(ctx.config).onReconnectRequired;
  if (hook !== undefined) {
    try {
      await hook({ provider: input.provider, accountId: input.accountId, kind: input.kind, reason: input.reason, at: now }, ctx);
    } catch (error) {
      console.error(`@softure-ai/connections: the onReconnectRequired hook failed: ${errorLogLabel(error)}`);
    }
  }
  return true;
}

/** Clears a refresh lease, only while `leaseId` still holds it. */
export async function releaseLease(ctx: ConnectionsContext, rowId: string, leaseId: string): Promise<void> {
  await ctx.db
    .update(accounts)
    .set({ leaseId: null, leaseUntil: null })
    .where(and(eq(accounts.id, rowId), eq(accounts.leaseId, leaseId)));
}

/** Splits a granted scope string; providers use spaces (RFC 6749) or commas. */
export function parseScopes(scope: string | null, requested: readonly string[]): string[] {
  if (scope === null) return [...requested];
  return scope.split(/[\s,]+/).filter((part) => part !== "");
}
