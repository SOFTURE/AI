// A fixed keyring for tests: `SOFTURE_CONNECTIONS_KEYS` values with known ids, never for production.
import { CONNECTIONS_KEYS_ENV } from "../server/crypto.js";

/**
 * An environment with a keyring of the given key ids (first one seals), each key derived from its id, so two
 * calls agree: `{ ...createTestKeyring(["new", "old"]), ...fake.env }`.
 */
export function createTestKeyring(ids: readonly string[] = ["test"]): Readonly<Record<string, string>> {
  const entries = ids.map((id) => `${id}:${Buffer.alloc(32, `softure-connections-test-${id}`).toString("base64url")}`);
  return { [CONNECTIONS_KEYS_ENV]: entries.join(",") };
}
