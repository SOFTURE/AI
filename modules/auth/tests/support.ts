// Shared setup: an app configuration with security and auth, and a migrated PGlite database.
import { createTestClock, defineSoftureConfig, type AnySoftureModule, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import type { AuthContext } from "@softure-ai/auth/server";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { headerIp, security } from "@softure-ai/security";
import { randomBytes, scryptSync } from "node:crypto";

export const NOW = new Date("2026-09-15T12:00:00Z");
export const DAY_MS = 24 * 60 * 60 * 1000;
export const CLIENT = "ip:192.0.2.10";
export const PASSWORD = "correct horse battery";

/** The lowest cost the options accept: tests hash in milliseconds. */
export const FAST_SCRYPT = { cost: 2 ** 10, blockSize: 8, parallelization: 1 } as const;

export interface ConfigOptions {
  readonly auth?: NonNullable<Parameters<typeof auth>[0]>;
  readonly appOrigin?: string;
  /** Bucket overrides on top of AUTH_RATE_LIMIT_BUCKETS. */
  readonly buckets?: Record<string, { limit: number; windowMinutes: number }>;
  /** The only buckets security gets, instead of the auth defaults. */
  readonly onlyBuckets?: Record<string, { limit: number; windowMinutes: number }>;
  /** Modules listed after auth, e.g. a switch provider. */
  readonly modules?: readonly AnySoftureModule[];
}

export function createConfig(options: ConfigOptions = {}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: options.appOrigin ?? "http://localhost:3000",
    modules: [
      security({
        clientIp: headerIp("x-real-ip"),
        buckets: options.onlyBuckets ?? { ...AUTH_RATE_LIMIT_BUCKETS, ...options.buckets },
        cleanupProbability: 0,
      }),
      auth({ ...options.auth, password: { scrypt: FAST_SCRYPT, ...options.auth?.password } }),
      ...(options.modules ?? []),
    ],
  });
}

export interface TestAuth {
  readonly ctx: AuthContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
}

export async function createTestAuth(options: ConfigOptions = {}): Promise<TestAuth> {
  const config = createConfig(options);
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database, config };
}

export async function countRows(database: TestDatabase, table: "users" | "sessions" | "password_resets"): Promise<number> {
  const result = await database.client.query<{ count: number }>(`SELECT count(*)::int AS count FROM auth.${table}`);
  return result.rows[0]?.count ?? 0;
}

/** Every rate limit row, as `bucket identifier attempts`. */
export async function listAttempts(database: TestDatabase): Promise<string[]> {
  const result = await database.client.query<{ bucket: string; identifier: string; attempts: number }>(
    "SELECT bucket, identifier, attempts FROM security.rate_limits ORDER BY bucket, identifier",
  );
  return result.rows.map((row) => `${row.bucket} ${row.identifier} ${String(row.attempts)}`);
}

/**
 * A scrypt hash of `password` exactly as given, without the NFC step the module applies: what an
 * older system that hashed raw input stored (issue #156, point 5).
 */
export function hashWithoutNormalizing(password: string, params: typeof FAST_SCRYPT): Promise<string> {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: params.cost, r: params.blockSize, p: params.parallelization });
  return Promise.resolve(["scrypt", params.cost, params.blockSize, params.parallelization, salt.toString("base64url"), key.toString("base64url")].join("$"));
}
