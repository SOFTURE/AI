// Reads the outbox file of `fakeMailProvider({ outboxFile })`, e.g. from a Playwright test.
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { CapturedMail } from "./fake-provider.js";

const capturedMailSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  replyTo: z.string().nullable(),
  subject: z.string(),
  text: z.string(),
  html: z.string().nullable(),
  headers: z.record(z.string(), z.string()),
  idempotencyKey: z.string().nullable(),
});

/** Every mail in the outbox, oldest first, optionally only those to `to`. A missing file is an empty outbox. */
export async function readMailOutbox(file: string, filter: { readonly to?: string } = {}): Promise<CapturedMail[]> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => capturedMailSchema.parse(JSON.parse(line)))
    .filter((mail) => filter.to === undefined || mail.to === filter.to);
}
