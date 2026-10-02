// The example's password reset sender (auth's `passwordReset.send`). A real app sends a mail here.
// The e2e sets PASSWORD_RESET_OUTBOX for the server it starts: each link is appended to that file
// as one JSON line, where e2e/auth-reset.spec.ts picks it up. Without it, auth's development
// sender prints the link (and refuses under `next start`, which runs in production mode).
import { appendFile } from "node:fs/promises";
import { consolePasswordResetSender, type PasswordResetSender } from "@softure-ai/auth";

export interface OutboxLine {
  readonly email: string;
  readonly link: string;
}

export const sendPasswordResetLink: PasswordResetSender = async (link, user, details) => {
  const outbox = process.env.PASSWORD_RESET_OUTBOX;
  if (outbox === undefined || outbox === "") return consolePasswordResetSender(link, user, details);
  const line: OutboxLine = { email: user.email, link };
  await appendFile(outbox, `${JSON.stringify(line)}\n`, "utf8");
};
