// Shared test setup: a configuration with the mailing module and a given provider, a migrated
// PGlite database, and an unsubscribe secret.
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { mailing, type MailingOptionsInput, type MailProvider, type OutgoingMail } from "@softure-ai/mailing";
import type { SuppressionContext } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";

export const FROM = "Example <hello@mail.example.com>";
export const REPLY_TO = "support@example.com";
export const NOW = new Date("2026-10-03T08:00:00Z");

/** 32 characters: the shortest secret the module accepts. */
export const SECRET = "test-unsubscribe-secret-32-chars";
export const PREVIOUS_SECRET = "previous-unsubscribe-secret-0032";

export const MAIL: OutgoingMail = {
  to: "ada@example.org",
  subject: "Your weekly summary",
  text: "Hello Ada, here is your summary.",
};

type ConfigOptions = Partial<MailingOptionsInput> & { readonly locale?: "en" | "pl"; readonly mailingInput?: Parameters<typeof mailing>[0] };

export function createConfig(provider: MailProvider, options: ConfigOptions = {}): SoftureConfig {
  const { locale = "en", mailingInput, ...mailingOptions } = options;
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale,
    timezone: "UTC",
    appOrigin: "https://app.example.com",
    modules: [mailing({ from: FROM, replyTo: REPLY_TO, provider, ...mailingOptions, ...mailingInput })],
  });
}

export interface TestMailing {
  readonly ctx: SuppressionContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
}

export async function createTestMailing(config: SoftureConfig = createConfig(fakeMailProvider())): Promise<TestMailing> {
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database, config };
}

/** Every stored row, as `recipient_key source created_at`. */
export async function listSuppressions(database: TestDatabase): Promise<string[]> {
  const result = await database.client.query<{ recipient_key: string; source: string; created_at: Date }>(
    "SELECT recipient_key, source, created_at FROM mailing.suppressions ORDER BY created_at, recipient_key",
  );
  return result.rows.map((row) => `${row.recipient_key} ${row.source} ${row.created_at.toISOString()}`);
}
