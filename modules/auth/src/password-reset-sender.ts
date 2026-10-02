// The hook through which auth hands a password reset link to the app, which delivers it (a mail,
// later the `@softure-ai/mailing` adapter). Auth never sends anything itself.
import type { Locale } from "@softure-ai/core";
import type { AuthUser } from "./contract.js";

export interface PasswordResetDetails {
  /** When the link stops working. */
  readonly expiresAt: Date;
  /** The app's locale, for the copy of the message. */
  readonly locale: Locale;
}

/**
 * Delivers a reset link to `user`. The link is built on `appOrigin` (never on the request's Host);
 * a multi-host app keeps its path and query and swaps the origin. It runs after the response is
 * sent, so a slow or failing sender never shows on the request page. A thrown error is logged
 * without the link.
 */
export type PasswordResetSender = (link: string, user: AuthUser, details: PasswordResetDetails) => Promise<void>;

/**
 * A development sender that prints the link to the server console. It refuses to run in
 * production, where a reset link in the logs would be a live credential in the logs.
 */
export const consolePasswordResetSender: PasswordResetSender = (link, user, details) => {
  if (process.env.NODE_ENV === "production") {
    return Promise.reject(
      new Error("@softure-ai/auth: consolePasswordResetSender is for development only; pass a real sender to auth({ passwordReset: { send } })"),
    );
  }
  console.info(`@softure-ai/auth: password reset link for ${user.email}, valid until ${details.expiresAt.toISOString()}: ${link}`);
  return Promise.resolve();
};
