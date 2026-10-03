// Shared setup: an app with security, auth, mailing (a fake provider), privacy (two legal documents)
// and the waitlist with a required `launch` scope tied to the privacy policy and an optional
// `newsletter` scope, offered from two placements.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { mailing } from "@softure-ai/mailing";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { headerIp, security } from "@softure-ai/security";
import { waitlist, WAITLIST_RATE_LIMIT_BUCKETS, type WaitlistOptionsInput } from "@softure-ai/waitlist";
import { withdrawWaitlistConsents, type WaitlistContext } from "@softure-ai/waitlist/server";

export const NOW = new Date("2026-10-03T08:00:00Z");
export const CLIENT = "ip:192.0.2.10";
/** 32 characters: the shortest unsubscribe secret mailing accepts (list mail needs one). */
export const SECRET = "test-unsubscribe-secret-32-chars";

export const DOCUMENTS = [
  { id: "terms", version: "2026-09-01" },
  { id: "privacy-policy", version: "2026-09-01" },
];

export const OPTIONS: WaitlistOptionsInput = {
  scopes: [
    { id: "launch", required: true, document: "privacy-policy", label: { en: "Tell me when it opens.", pl: "Daj mi znac o starcie." } },
    { id: "newsletter", label: { en: "Send me the newsletter." } },
  ],
  placements: ["hero", "footer"],
};

export interface ConfigOptions {
  /** The waitlist's options and reserved keys (`messages`), in place of `OPTIONS`. */
  readonly waitlist?: Parameters<typeof waitlist>[0];
  readonly documents?: typeof DOCUMENTS;
  readonly buckets?: Readonly<Record<string, { limit: number; windowMinutes: number }>>;
  readonly locale?: "en" | "pl";
}

export function createConfig(provider: FakeMailProvider, options: ConfigOptions = {}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: options.locale ?? "en",
    timezone: "UTC",
    appOrigin: "https://app.example.com",
    modules: [
      security({
        clientIp: headerIp("x-real-ip"),
        buckets: options.buckets ?? { ...AUTH_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS, ...WAITLIST_RATE_LIMIT_BUCKETS },
        cleanupProbability: 0,
      }),
      auth({ password: { scrypt: { cost: 2 ** 10 } } }),
      mailing({ from: "Example <hello@mail.example.com>", provider, onUnsubscribed: withdrawWaitlistConsents }),
      privacy({ documents: options.documents ?? DOCUMENTS }),
      waitlist(options.waitlist ?? OPTIONS),
    ],
  });
}

export interface TestWaitlist {
  readonly ctx: WaitlistContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
  readonly provider: FakeMailProvider;
}

export async function createTestWaitlist(options: ConfigOptions = {}, provider: FakeMailProvider = fakeMailProvider()): Promise<TestWaitlist> {
  const config = createConfig(provider, options);
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database, config, provider };
}

export interface ConsentRow {
  purpose: string;
  granted: boolean;
  document_id: string | null;
  document_version: string | null;
  source: string;
  recorded_at: Date;
}

/** The consent rows of an email address, oldest first. */
export async function listConsentRows(test: TestWaitlist, emailKey: string): Promise<ConsentRow[]> {
  const result = await test.database.client.query<ConsentRow>(
    "SELECT purpose, granted, document_id, document_version, source, recorded_at FROM privacy.consents WHERE email_key = $1 ORDER BY recorded_at, id",
    [emailKey],
  );
  return result.rows;
}
