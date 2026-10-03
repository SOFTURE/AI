// The files the example appends outgoing mail to while the e2e runs: reset links
// (lib/password-reset-sender.ts) and the fake mail provider's outbox (softure.config.ts).
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const outboxLine = z.object({ email: z.string(), link: z.string() });

export const PASSWORD_RESET_OUTBOX = join(tmpdir(), "softure-example-e2e-password-reset-outbox.jsonl");

/** The outbox of the example's fake mail provider (`MAIL_OUTBOX`, softure.config.ts); read with `readMailOutbox`. */
export const MAIL_OUTBOX = join(tmpdir(), "softure-example-e2e-mail-outbox.jsonl");

/**
 * The secret the app under test signs unsubscribe links with (playwright.config.ts). A test value:
 * the e2e server is local and throwaway.
 */
export const MAILING_UNSUBSCRIBE_SECRET = "e2e-unsubscribe-secret-not-for-production";

/** Every link sent to `email` so far, oldest first. */
export async function readResetLinks(email: string): Promise<string[]> {
  let text: string;
  try {
    text = await readFile(PASSWORD_RESET_OUTBOX, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => outboxLine.parse(JSON.parse(line)))
    .filter((line) => line.email === email)
    .map((line) => line.link);
}
