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
  // Base64 in the file, bytes again here; lines written before attachments existed have none.
  attachments: z
    .array(z.object({ filename: z.string(), contentType: z.string(), content: z.base64().transform((content) => new Uint8Array(Buffer.from(content, "base64"))) }))
    .optional(),
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
    .map((line) => toCapturedMail(capturedMailSchema.parse(JSON.parse(line))))
    .filter((mail) => filter.to === undefined || mail.to === filter.to);
}

/** A parsed line without an `attachments: undefined` key, so a mail without attachments equals what was sent. */
function toCapturedMail(line: z.output<typeof capturedMailSchema>): CapturedMail {
  const { attachments, ...mail } = line;
  return attachments === undefined ? mail : { ...mail, attachments };
}
