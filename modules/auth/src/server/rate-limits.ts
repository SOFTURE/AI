// The rate limit buckets auth consumes (AUTH_RATE_LIMIT_BUCKETS). Each attempt is counted before the
// work it guards, hashing included, so a flood is stopped before it costs anything.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { subjectKey } from "@softure-ai/security/server";

export const BUCKETS = {
  register: "register",
  login: "login",
  loginAccount: "login-account",
  changePassword: "change-password",
} as const;

/** The subject key of an account's email for `login-account`. */
export function emailSubjectKey(normalizedEmail: string): string {
  return subjectKey(`email:${normalizedEmail}`);
}

/** The subject key of a user for `change-password`. */
export function userSubjectKey(userId: string): string {
  return subjectKey(`user:${userId}`);
}

const checkedConfigs = new WeakSet<SoftureConfig>();

/**
 * Throws, naming every missing bucket, when the app's `security({ buckets })` lacks one auth
 * counts in. Checked once per config, before the first attempt is counted, so a setup mistake is
 * one clear error instead of a generic failure on every login.
 */
export function assertAuthBuckets(config: SoftureConfig): void {
  if (checkedConfigs.has(config)) return;
  const options = getModule(config, "security")?.options as { buckets?: Readonly<Record<string, unknown>> } | undefined;
  const configured = options?.buckets ?? {};
  const missing = Object.values(BUCKETS).filter((name) => !Object.hasOwn(configured, name));
  if (missing.length > 0) {
    throw new Error(
      `@softure-ai/auth: security({ buckets }) lacks ${missing.map((name) => `"${name}"`).join(", ")}; spread AUTH_RATE_LIMIT_BUCKETS into it`,
    );
  }
  checkedConfigs.add(config);
}
