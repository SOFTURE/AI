// The operator's tools for turning billing on for accounts that already exist: safe ops scripts
// (`@softure-ai/ops/scripts`), dry run by default, `--commit` writes. `import-entitlements` records
// what another system knew (trial ends, paid periods, lifetime access) from a JSON file through
// `importEntitlement`; `pin-trials` writes every derived trial into a row before a config change
// would move it (`pinDerivedTrials`). Reports and refusals carry counts and row numbers, never an
// email.
import { readFile } from "node:fs/promises";
import { users } from "@softure-ai/auth";
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { entitlements } from "../schema.js";
import { getEntitlement, importEntitlement, pinDerivedTrials, type BillingContext } from "../server/entitlements.js";
import { findAccountByEmail } from "../server/plans.js";

export interface ImportEntitlementsScriptArgs {
  readonly file: string;
}

export type PinTrialsScriptArgs = Record<string, never>;

export interface EntitlementScriptOptions {
  /** The time stored as the rows' `created_at` / `updated_at`; the system clock by default. */
  readonly clock?: Clock;
}

/** The most rows one import file holds; split a larger one. */
export const MAX_IMPORT_ROWS = 50_000;
/** The most problems a refusal lists. */
const MAX_LISTED = 10;

const importArgs = z.strictObject({
  file: z.string().min(1, "--file=<path to a JSON file> is required"),
});

const pinArgs = z.strictObject({});

const instant = z.iso
  .datetime({ offset: true, message: "must be an ISO 8601 date-time with an offset, e.g. 2026-11-01T00:00:00+01:00" })
  .transform((text) => new Date(text));

const importRow = z
  .strictObject({
    email: z.string().trim().min(1, "is required").max(320),
    trialEndsAt: instant.nullable().optional(),
    paidUntil: instant.nullable().optional(),
    isLifetime: z.boolean().optional(),
  })
  .refine((row) => (row.trialEndsAt ?? row.paidUntil ?? row.isLifetime) != null, "needs trialEndsAt, paidUntil or isLifetime");

const importFile = z.array(importRow).min(1, "holds no rows").max(MAX_IMPORT_ROWS, `holds more than ${String(MAX_IMPORT_ROWS)} rows; split it`);

type ImportRow = z.output<typeof importRow>;

/** Where the imported accounts stand: how many are in each state. */
interface ImportSummary {
  readonly accounts: number;
  readonly trial: number;
  readonly paid: number;
  readonly lifetime: number;
  readonly readOnly: number;
}

/** "rows 3, 7 and 12" style, at most `MAX_LISTED` of them. */
function describeRows(rows: readonly number[]): string {
  const listed = rows.slice(0, MAX_LISTED).map(String);
  const more = rows.length > MAX_LISTED ? ` and ${String(rows.length - MAX_LISTED)} more` : "";
  return `${rows.length === 1 ? "row" : "rows"} ${listed.join(", ")}${more}`;
}

/** The file's rows, or why they cannot be imported. Row numbers count from 1. */
async function readImportFile(path: string): Promise<{ readonly ok: true; readonly rows: readonly ImportRow[] } | { readonly ok: false; readonly reason: string }> {
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
    return { ok: false, reason: `the file must be a JSON array of { email, trialEndsAt?, paidUntil?, isLifetime? }: ${problems.join("; ")}` };
  }
  return { ok: true, rows: parsed.data };
}

/** Row numbers of emails seen earlier in the file (compared as auth stores emails). */
function findRepeatedRows(rows: readonly ImportRow[]): number[] {
  const seen = new Set<string>();
  const repeated: number[] = [];
  rows.forEach((row, index) => {
    const key = row.email.toLowerCase();
    if (seen.has(key)) repeated.push(index + 1);
    seen.add(key);
  });
  return repeated;
}

async function summarize(ctx: BillingContext, userIds: readonly string[]): Promise<ImportSummary> {
  const summary = { accounts: userIds.length, trial: 0, paid: 0, lifetime: 0, readOnly: 0 };
  for (const userId of userIds) {
    const entitlement = await getEntitlement(ctx, userId);
    // The accounts were found under the script's transaction; one erased meanwhile counts as none.
    if (entitlement === null) continue;
    if (entitlement.status === "read_only") summary.readOnly += 1;
    else if (entitlement.status === "trial") summary.trial += 1;
    else if (entitlement.endsAt === null) summary.lifetime += 1;
    else summary.paid += 1;
  }
  return summary;
}

/** `import-entitlements --file=…`: records trial ends, paid periods and lifetime access from a JSON file. */
export function createImportEntitlementsScript(config: SoftureConfig, options: EntitlementScriptOptions = {}): OpsScript<ImportEntitlementsScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "import-entitlements",
    description: "Records the trial ends, paid periods and lifetime access in a JSON file for the accounts it names by email; never shortens access.",
    usage: ["--file=<path to a JSON array of { email, trialEndsAt?, paidUntil?, isLifetime? }>"],
    args: importArgs,
    run: async (tx, args) => {
      const ctx: BillingContext = { db: tx, clock, config };
      const file = await readImportFile(args.file);
      if (!file.ok) return refuseOpsScript(file.reason);
      const repeated = findRepeatedRows(file.rows);
      if (repeated.length > 0) return refuseOpsScript(`${describeRows(repeated)} repeat an email named earlier in the file`);

      const userIds: string[] = [];
      const unknown: number[] = [];
      for (const [index, row] of file.rows.entries()) {
        const account = await findAccountByEmail(ctx, row.email);
        if (account === null) unknown.push(index + 1);
        else userIds.push(account.id);
      }
      if (unknown.length > 0) return refuseOpsScript(`${describeRows(unknown)} name no account; nothing was imported`);

      const before = await summarize(ctx, userIds);
      for (const [index, row] of file.rows.entries()) {
        const userId = userIds[index];
        // One id per row: every row found an account above.
        if (userId === undefined) throw new Error(`import-entitlements: row ${String(index + 1)} lost its account`);
        const imported = await importEntitlement(ctx, { userId, trialEndsAt: row.trialEndsAt, paidUntil: row.paidUntil, isLifetime: row.isLifetime });
        // Erased between the lookup and the change's lock.
        if (!imported.ok) return refuseOpsScript(`${describeRows([index + 1])} names an account that was deleted meanwhile; nothing was imported`);
      }
      return ok({ before, after: await summarize(ctx, userIds) });
    },
  });
}

async function countAccountsWithoutRow(db: Queryable): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(users)
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(isNull(entitlements.userId));
  return row?.total ?? 0;
}

/** `pin-trials`: writes every derived trial into a row, so a config change moves none of them. */
export function createPinTrialsScript(config: SoftureConfig, options: EntitlementScriptOptions = {}): OpsScript<PinTrialsScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "pin-trials",
    description: "Writes the trial every account without an entitlement row is on into a row, before trial.days, trial.startsAt or the time zone changes.",
    usage: [],
    args: pinArgs,
    run: async (tx) => {
      const ctx: BillingContext = { db: tx, clock, config };
      const before = { accountsWithoutRow: await countAccountsWithoutRow(tx) };
      const pinned = await pinDerivedTrials(ctx);
      return ok({ before, after: { accountsWithoutRow: await countAccountsWithoutRow(tx), pinned } });
    },
  });
}
