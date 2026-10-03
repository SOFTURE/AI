// The rate limit buckets privacy consumes (PRIVACY_RATE_LIMIT_BUCKETS), both counted per user.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { subjectKey } from "@softure-ai/security/server";

export const BUCKETS = {
  export: "privacy-export",
  delete: "privacy-delete",
} as const;

/** The subject key of a user in the privacy buckets. */
export function userSubjectKey(userId: string): string {
  return subjectKey(`user:${userId}`);
}

const checkedConfigs = new WeakSet<SoftureConfig>();

/**
 * Throws, naming every missing bucket, when the app's `security({ buckets })` lacks one privacy
 * counts in. Checked once per config, before the first attempt is counted.
 */
export function assertPrivacyBuckets(config: SoftureConfig): void {
  if (checkedConfigs.has(config)) return;
  const options = getModule(config, "security")?.options as { buckets?: Readonly<Record<string, unknown>> } | undefined;
  const configured = options?.buckets ?? {};
  const missing = Object.values(BUCKETS).filter((name) => !Object.hasOwn(configured, name));
  if (missing.length > 0) {
    throw new Error(
      `@softure-ai/privacy: security({ buckets }) lacks ${missing.map((name) => `"${name}"`).join(", ")}; spread PRIVACY_RATE_LIMIT_BUCKETS into it`,
    );
  }
  checkedConfigs.add(config);
}
