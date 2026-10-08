import { z } from "zod";

/**
 * The result of one integration run, stored as a git note on the tested commit under {@link INTEGRATION_NOTES_REF}.
 * One line of JSON, so `git notes show` prints it whole. A newer run on the same commit replaces it.
 */

export const INTEGRATION_NOTES_REF = "refs/notes/integration";

const HTTPS_URL = /^https:\/\/\S+$/;

export const integrationNoteSchema = z.strictObject({
  version: z.literal(1),
  result: z.enum(["green", "red"]),
  sha: z.string().regex(/^[0-9a-f]{40}$/, "a full commit SHA"),
  name: z.string().min(1),
  ref: z.string().min(1),
  /** Unknown (null) when the run wrote no JUnit report. */
  passed: z.number().int().nonnegative().nullable(),
  total: z.number().int().nonnegative().nullable(),
  red: z.array(z.string()),
  run: z.string().regex(HTTPS_URL, "an https:// URL of the run").nullable(),
  finishedAt: z.iso.datetime(),
});

export type IntegrationNote = z.infer<typeof integrationNoteSchema>;

export type ParsedIntegrationNote = { ok: true; note: IntegrationNote } | { ok: false; problem: string };

export function parseIntegrationNote(text: string): ParsedIntegrationNote {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { ok: false, problem: "the note is not JSON" };
  }
  const parsed = integrationNoteSchema.safeParse(json);
  if (parsed.success) return { ok: true, note: parsed.data };
  const issue = parsed.error.issues[0];
  const path = issue?.path.join(".") ?? "";
  return { ok: false, problem: `${path === "" ? "the note" : path}: ${issue?.message ?? "invalid"}` };
}

export function formatIntegrationNote(note: IntegrationNote): string {
  return `${JSON.stringify(note)}\n`;
}
