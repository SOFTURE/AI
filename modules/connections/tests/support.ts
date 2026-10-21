// Shared setup: an app configuration with security, auth and connections (a fake OAuth provider, an API key
// provider and a Basic provider), a test keyring, and a migrated PGlite database.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { connections, type ConnectionsOptionsInput, type ProviderDefinitionInput } from "@softure-ai/connections";
import type { ConnectionsContext } from "@softure-ai/connections/server";
import { createFakeOAuthProvider, createTestKeyring, type FakeOAuthProvider, type FakeOAuthProviderOptions } from "@softure-ai/connections/testing";
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { headerIp, security } from "@softure-ai/security";

export const NOW = new Date("2026-10-21T12:00:00Z");
export const ADMIN = "7d1f3c1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";
export const OTHER_ADMIN = "0b9e2f4a-6c1d-4e3b-9a8f-7c6d5e4f3a2b";

export const KEY_PROVIDERS: ProviderDefinitionInput[] = [
  { kind: "api_key", id: "raindrop", label: { en: "Raindrop" }, hint: { en: "Settings, Integrations, Test token." } },
  { kind: "basic", id: "toggl", label: { en: "Toggl" }, accounts: ["work", "personal"] },
];

export function createConfig(providers: ProviderDefinitionInput[], options: Omit<ConnectionsOptionsInput, "providers"> = {}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "https://app.example.com",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: AUTH_RATE_LIMIT_BUCKETS, cleanupProbability: 0 }),
      auth({ password: { scrypt: { cost: 2 ** 10 } } }),
      connections({ providers, refreshWait: { attempts: 40, intervalMs: 5 }, ...options }),
    ],
  });
}

export interface TestConnections {
  readonly ctx: ConnectionsContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
  readonly fake: FakeOAuthProvider;
}

export interface CreateTestConnectionsOptions {
  readonly fake?: FakeOAuthProviderOptions;
  readonly connections?: Omit<ConnectionsOptionsInput, "providers" | "fetch">;
  readonly keys?: readonly string[];
  readonly providers?: (fake: FakeOAuthProvider) => ProviderDefinitionInput[];
}

export async function createTestConnections(options: CreateTestConnectionsOptions = {}): Promise<TestConnections> {
  const fake = createFakeOAuthProvider(options.fake);
  const providers = options.providers?.(fake) ?? [fake.definition, ...KEY_PROVIDERS];
  const config = createConfig(providers, { ...options.connections, fetch: fake.fetch });
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  const env = { ...createTestKeyring(options.keys), ...fake.env };
  return { ctx: { db: database.db, clock, config, env }, clock, database, config, fake };
}

/** Every stored connection, as `provider/account status kind key_id`. */
export async function listRows(database: TestDatabase): Promise<string[]> {
  const result = await database.client.query<{ provider: string; account_id: string; status: string; kind: string; key_id: string }>(
    "SELECT provider, account_id, status, kind, key_id FROM connections.accounts ORDER BY provider, account_id",
  );
  return result.rows.map((row) => `${row.provider}/${row.account_id} ${row.status} ${row.kind} ${row.key_id}`);
}

/** The raw stored columns of one connection, to check that nothing is in plain text. */
export async function readRawRow(database: TestDatabase, provider: string, accountId = "default"): Promise<Record<string, unknown>> {
  const result = await database.client.query<Record<string, unknown>>("SELECT * FROM connections.accounts WHERE provider = $1 AND account_id = $2", [
    provider,
    accountId,
  ]);
  const [row] = result.rows;
  if (row === undefined) throw new Error(`test: no row for ${provider}/${accountId}`);
  return row;
}
