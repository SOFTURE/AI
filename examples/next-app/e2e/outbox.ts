// The file the example's reset sender appends links to while the e2e runs (lib/password-reset-sender.ts).
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const outboxLine = z.object({ email: z.string(), link: z.string() });

export const PASSWORD_RESET_OUTBOX = join(tmpdir(), "softure-example-e2e-password-reset-outbox.jsonl");

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
