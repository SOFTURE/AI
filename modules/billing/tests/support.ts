// Shared setup: an app in Warsaw time with security, auth, privacy and billing (a 14-day trial with
// a 3-day reminder, a 7-day renewal reminder, the payment bucket), and helpers to create accounts
// at a given instant.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { registerUser } from "@softure-ai/auth/server";
import { billing, BILLING_RATE_LIMIT_BUCKETS } from "@softure-ai/billing";
import type { BillingContext } from "@softure-ai/billing/server";
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { headerIp, security } from "@softure-ai/security";

/** 3 October 2026, 10:00 in Warsaw (CEST, UTC+2). */
export const NOW = new Date("2026-10-03T08:00:00Z");
export const TIMEZONE = "Europe/Warsaw";
export const CLIENT = "ip:192.0.2.10";
const PASSWORD = "correct horse battery";

/** The billing options and reserved keys (`routes`, `messages`). */
export type BillingInput = Parameters<typeof billing>[0];

/** `authRoles` are the roles `auth({ roles })` declares beside `admin`. */
export function createConfig(options: BillingInput = {}, authRoles: readonly string[] = []): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: TIMEZONE,
    appOrigin: "https://app.example.com",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS, ...BILLING_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
      auth({ password: { scrypt: { cost: 2 ** 10 } }, requireConsent: false, roles: [...authRoles] }),
      privacy(),
      billing(options),
    ],
  });
}

export interface TestBilling {
  readonly ctx: BillingContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
}

export async function createTestBilling(options: BillingInput = {}): Promise<TestBilling> {
  const config = createConfig(options);
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database, config };
}

/** Registers an account at the clock's current instant and returns its id. */
export async function createAccount(test: Pick<TestBilling, "ctx">, email: string): Promise<string> {
  const registered = await registerUser(test.ctx, { email, password: PASSWORD, hasConsented: false, clientKey: CLIENT });
  if (!registered.ok) throw new Error(`registration failed with ${registered.error}`);
  return registered.value.user.id;
}

export interface EntitlementRow {
  trial_ends_at: Date;
  paid_until: Date | null;
  is_lifetime: boolean;
  created_at: Date;
  updated_at: Date;
}

/** The stored row of an account, or undefined. */
export async function readRow(test: TestBilling, userId: string): Promise<EntitlementRow | undefined> {
  const result = await test.database.client.query<EntitlementRow>(
    "SELECT trial_ends_at, paid_until, is_lifetime, created_at, updated_at FROM billing.entitlements WHERE user_id = $1",
    [userId],
  );
  return result.rows[0];
}
