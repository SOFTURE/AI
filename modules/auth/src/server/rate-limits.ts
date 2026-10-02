// The rate limit buckets auth consumes (AUTH_RATE_LIMIT_BUCKETS). Each attempt is counted before the
// work it guards, hashing included, so a flood is stopped before it costs anything.
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
