// The outbox file of the example's fake mail provider (MAIL_OUTBOX, softure.config.ts), which
// Playwright sets for the server it starts. Every mail lands there, password reset mails included.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readMailOutbox } from "@softure-ai/mailing/testing";

/** The outbox of the example's fake mail provider; read with `readMailOutbox`. */
export const MAIL_OUTBOX = join(tmpdir(), "softure-example-e2e-mail-outbox.jsonl");

/**
 * The secret the app under test signs unsubscribe links with (playwright.config.ts). A test value:
 * the e2e server is local and throwaway.
 */
export const MAILING_UNSUBSCRIBE_SECRET = "e2e-unsubscribe-secret-not-for-production";

/** A reset link as auth builds it: the reset route with a 43-character token. */
const RESET_LINK = /^https?:\/\/\S+\/reset-password\?token=[A-Za-z0-9_-]{43}$/m;

/** Every reset link mailed to `email` so far, oldest first (the link is a line of the text body). */
export async function readResetLinks(email: string): Promise<string[]> {
  const mails = await readMailOutbox(MAIL_OUTBOX, { to: email });
  return mails.flatMap((mail) => mail.text.match(RESET_LINK) ?? []);
}
