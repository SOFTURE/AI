// Key rotation: re-seals every stored secret that names a key other than the keyring's current one. Run it after
// putting a new key first in `SOFTURE_CONNECTIONS_KEYS`; once it reports nothing left, the old key can go.
// A dry run (the default of `softure-connections rotate-keys`) only counts.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq, ne } from "drizzle-orm";
import type { ConnectionsKeyErrorCode } from "../contract.js";
import { accounts, oauthStates } from "../schema.js";
import { getCredentialContext, sealSecret } from "./crypto.js";
import { getKeyring, openPayloadText, type ConnectionsContext } from "./store.js";

export interface ReencryptReport {
  /** The key every secret is sealed with afterwards. */
  readonly currentKeyId: string;
  /** Connections sealed with an older key: re-sealed, or (dry run) to re-seal. */
  readonly connections: number;
  /** Pending authorizations sealed with an older key: deleted (they are minutes old), or (dry run) to delete. */
  readonly pendingAuthorizations: number;
  /** Connections whose key is not in the keyring or whose ciphertext does not open: left as they are. */
  readonly unreadable: readonly { readonly provider: string; readonly accountId: string; readonly error: ConnectionsKeyErrorCode }[];
}

export interface ReencryptOptions {
  /** Count only; write nothing. */
  readonly dryRun: boolean;
}

/** Re-seals every connection under the current key. Each row is written only if nobody changed it meanwhile. */
export async function reencryptConnections(ctx: ConnectionsContext, options: ReencryptOptions): Promise<Ok<ReencryptReport> | Err<"connections.key_missing" | "connections.key_invalid">> {
  const keyring = getKeyring(ctx);
  if (!keyring.ok) return err(keyring.error);
  const current = keyring.value.current.id;
  const rows = await ctx.db.select().from(accounts).where(ne(accounts.keyId, current));
  const states = await ctx.db.select({ stateHash: oauthStates.stateHash }).from(oauthStates).where(ne(oauthStates.keyId, current));
  const unreadable: { provider: string; accountId: string; error: ConnectionsKeyErrorCode }[] = [];
  let resealed = 0;
  for (const row of rows) {
    const opened = openPayloadText(keyring.value, row);
    if (!opened.ok) {
      unreadable.push({ provider: row.provider, accountId: row.accountId, error: opened.error });
      continue;
    }
    resealed += 1;
    if (options.dryRun) continue;
    const sealed = sealSecret(keyring.value, opened.value, getCredentialContext(row.provider, row.accountId));
    // Conditional on the ciphertext read: a refresh that stored a new one meanwhile already used the current key.
    await ctx.db
      .update(accounts)
      .set({ keyId: sealed.keyId, credentials: sealed.sealed })
      .where(and(eq(accounts.id, row.id), eq(accounts.credentials, row.credentials)));
  }
  if (!options.dryRun) {
    for (const state of states) {
      // The authorization is minutes old at most: dropping it is simpler than re-sealing its verifier, and the
      // admin clicks connect again.
      await ctx.db.delete(oauthStates).where(eq(oauthStates.stateHash, state.stateHash));
    }
  }
  return ok({ currentKeyId: current, connections: resealed, pendingAuthorizations: states.length, unreadable });
}
