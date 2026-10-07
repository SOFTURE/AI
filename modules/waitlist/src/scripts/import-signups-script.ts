// `import-signups --file=…`: the operator's way to move an app's own sign-up list onto the module, as a
// safe ops script (`@softure-ai/ops/scripts`): dry run by default, `--commit` writes. The file is a JSON
// array of rows with ISO 8601 times; the app's own scope names can stay in it when the script is
// created with `scopeAliases`. The work and its rules are `importSignups`; refusals carry row
// numbers, never an email.
import { readFile } from "node:fs/promises";
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import type { Env } from "@softure-ai/mailing/server";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { count, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { signups } from "../schema.js";
import { importSignups, MAX_IMPORT_ROWS, type ImportSignupRow } from "../server/import.js";

export interface ImportSignupsScriptArgs {
  readonly file: string;
}

export interface ImportSignupsScriptOptions {
  /** The time stored as `updated_at` and the limit no imported time may pass; the system clock by default. */
  readonly clock?: Clock;
  /**
   * The app's own scope names and the module scopes each stands for, e.g. `{ lists: ["launch",
   * "newsletter"], start: ["launch"] }`. A row's scope that is an alias is replaced by its scopes.
   */
  readonly scopeAliases?: Readonly<Record<string, readonly string[]>>;
  /** Where `MAILING_UNSUBSCRIBE_SECRET` is read; `process.env` by default. */
  readonly env?: Env;
}

/** The most problems a refusal lists. */
const MAX_LISTED = 10;

const args = z.strictObject({
  file: z.string().min(1, "--file=<path to a JSON file> is required"),
});

const instant = z.iso
  .datetime({ offset: true, message: "must be an ISO 8601 date-time with an offset, e.g. 2026-05-01T09:30:00+02:00" })
  .transform((text) => new Date(text));

const fileRow = z.strictObject({
  id: z.string().optional(),
  email: z.string().max(320),
  scopes: z.array(z.string().max(64)).max(32),
  placement: z.string().max(64),
  locale: z.string().max(8),
  signedUpAt: instant,
  confirmedAt: instant.optional(),
  consentedAt: instant.optional(),
  documentVersions: z.record(z.string().max(64), z.string().max(64)).optional(),
  channel: z.string().max(64).nullable().optional(),
  unsubscribedAt: instant.nullable().optional(),
});

const importFile = z.array(fileRow).min(1, "holds no rows").max(MAX_IMPORT_ROWS, `holds more than ${String(MAX_IMPORT_ROWS)} rows; split it`);

type FileRow = z.output<typeof fileRow>;

/** The file's rows, or why they cannot be read. Row numbers count from 1. */
async function readImportFile(path: string): Promise<{ readonly ok: true; readonly rows: readonly FileRow[] } | { readonly ok: false; readonly reason: string }> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "unknown error";
    return { ok: false, reason: `cannot read the file "${path}" (${code})` };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: `the file "${path}" is not valid JSON` };
  }
  const parsed = importFile.safeParse(json);
  if (!parsed.success) {
    const problems = parsed.error.issues.slice(0, MAX_LISTED).map((issue) => {
      const [index, ...field] = issue.path;
      if (typeof index !== "number") return `the file ${issue.message}`;
      return `row ${String(index + 1)}${field.length > 0 ? ` ${field.join(".")}` : ""}: ${issue.message}`;
    });
    return { ok: false, reason: `the file must be a JSON array of { email, scopes, placement, locale, signedUpAt, … }: ${problems.join("; ")}` };
  }
  return { ok: true, rows: parsed.data };
}

/** The row's scopes with each alias replaced by its scopes, without repeats. */
function expandScopes(scopes: readonly string[], aliases: Readonly<Record<string, readonly string[]>>): string[] {
  const expanded = scopes.flatMap((scope) => (Object.hasOwn(aliases, scope) ? (aliases[scope] ?? []) : [scope]));
  return [...new Set(expanded)];
}

function toImportRow(row: FileRow, aliases: Readonly<Record<string, readonly string[]>>): ImportSignupRow {
  const { id, confirmedAt, consentedAt, documentVersions, channel, unsubscribedAt, ...required } = row;
  return {
    ...required,
    scopes: expandScopes(row.scopes, aliases),
    ...(id === undefined ? {} : { id }),
    ...(confirmedAt === undefined ? {} : { confirmedAt }),
    ...(consentedAt === undefined ? {} : { consentedAt }),
    ...(documentVersions === undefined ? {} : { documentVersions }),
    ...(channel === undefined ? {} : { channel }),
    ...(unsubscribedAt === undefined ? {} : { unsubscribedAt }),
  };
}

async function countSignups(db: Queryable): Promise<number> {
  const [row] = await db.select({ total: count() }).from(signups).where(isNotNull(signups.confirmedAt));
  return row?.total ?? 0;
}

/** `import-signups --file=…`: imports the app's own sign-up list with its consent history. */
export function createImportSignupsScript(config: SoftureConfig, options: ImportSignupsScriptOptions = {}): OpsScript<ImportSignupsScriptArgs> {
  const clock = options.clock ?? systemClock;
  const aliases = options.scopeAliases ?? {};
  return defineOpsScript({
    name: "import-signups",
    description: "Imports an app's own sign-up list from a JSON file: rows with their sign-up time and id, consents at the time they were given, opt-outs of who unsubscribed; never narrows scopes.",
    usage: ["--file=<path to a JSON array of { email, scopes, placement, locale, signedUpAt, id?, confirmedAt?, consentedAt?, documentVersions?, channel?, unsubscribedAt? }>"],
    args,
    run: async (tx, { file }) => {
      const read = await readImportFile(file);
      if (!read.ok) return refuseOpsScript(read.reason);
      const before = { signups: await countSignups(tx) };
      const imported = await importSignups(
        { db: tx, clock, config },
        read.rows.map((row) => toImportRow(row, aliases)),
        options.env === undefined ? {} : { env: options.env },
      );
      if (!imported.ok) return refuseOpsScript(imported.problems.join("; "));
      return ok({ before, after: { signups: await countSignups(tx), ...imported.value } });
    },
  });
}
