// One-statement snapshots of the database for the schema guard and the row counts. Each statement prints one JSON
// line, so the same text runs through `pg` (the connection mode) or `psql -At` in the database's own container (the
// stdin mode, where the CLI never connects). A table that may be absent is read through `query_to_xml`, which is
// volatile: inside `CASE WHEN to_regclass(…) IS NULL` its query runs only for a table that exists, so one statement
// copes with a database before its first migration. JSON rides base64-encoded inside the XML text node.
import { z } from "zod";
import { TABLE_NAME_PATTERN, type RowCounts } from "./row-counts.js";

/** drizzle's migration ledger: the app ledger the guard reads unless `--app-ledger` names another. */
export const DEFAULT_APP_LEDGER = "drizzle.__drizzle_migrations";

const MODULE_LEDGER = "softure.migrations";

function quoteTable(table: string): string {
  return table
    .split(".")
    .map((part) => `"${part}"`)
    .join(".");
}

function toSqlLiteral(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

/** The text of the column `v` of `query`'s one row when `table` exists, else NULL. */
function readIfPresent(table: string, query: string): string {
  return (
    `CASE WHEN to_regclass(${toSqlLiteral(quoteTable(table))}) IS NULL THEN NULL ` +
    `ELSE (xpath('/row/v/text()', query_to_xml(${toSqlLiteral(query)}, false, true, '')))[1]::text END`
  );
}

function assertTableName(table: string): void {
  if (!TABLE_NAME_PATTERN.test(table)) throw new Error(`snapshot query: not a table name: ${table}`);
}

/** Counts the rows of `table`, or NULL when the database lacks it. */
function countIfPresent(table: string): string {
  return `(${readIfPresent(table, `SELECT count(*) AS v FROM ${quoteTable(table)}`)})::bigint`;
}

/**
 * The statement of the guard's snapshot: `{"softure":[ledger rows…],"app":{"ledger":…,"rows":n|null}|null}`. `app` is
 * null without `appLedger`; `rows` is null when that table does not exist.
 */
export function buildLedgerQuery(options: { appLedger: string | null }): string {
  const rows =
    "SELECT encode(convert_to(coalesce(json_agg(json_build_object('module', module, 'version', version, 'name', name, " +
    `'checksum', checksum, 'method', method) ORDER BY id)::text, '[]'), 'UTF8'), 'base64') AS v FROM ${MODULE_LEDGER}`;
  const softure = `coalesce(convert_from(decode(${readIfPresent(MODULE_LEDGER, rows)}, 'base64'), 'UTF8')::json, '[]'::json)`;
  let app = "NULL::json";
  if (options.appLedger !== null) {
    assertTableName(options.appLedger);
    app = `json_build_object('ledger', ${toSqlLiteral(options.appLedger)}, 'rows', ${countIfPresent(options.appLedger)})`;
  }
  return `SELECT json_build_object('softure', ${softure}, 'app', ${app})::text AS snapshot`;
}

/**
 * The statement of the row counts' snapshot: `{"<table>":<rows>|null,…}`, null for a table the database lacks. jsonb
 * objects are joined with `||`, so no function-argument limit caps the number of tables.
 */
export function buildRowCountQuery(tables: readonly string[]): string {
  if (tables.length === 0) throw new Error("snapshot query: no table to count");
  const parts = tables.map((table) => {
    assertTableName(table);
    return `jsonb_build_object(${toSqlLiteral(table)}, ${countIfPresent(table)})`;
  });
  return `SELECT (${parts.join(" || ")})::text AS snapshot`;
}

const journalRowSchema = z.strictObject({
  module: z.string().min(1),
  version: z.int().min(1),
  name: z.string().min(1),
  checksum: z.string().min(1),
  method: z.enum(["applied", "adopted"]),
});

const ledgerSnapshotSchema = z.strictObject({
  softure: z.array(journalRowSchema),
  app: z.strictObject({ ledger: z.string().regex(TABLE_NAME_PATTERN), rows: z.int().nonnegative().nullable() }).nullable(),
});

export type LedgerSnapshot = z.infer<typeof ledgerSnapshotSchema>;

export type SnapshotResult<T> = { ok: true; value: T } | { ok: false; problem: string };

function parseJson(text: string): SnapshotResult<unknown> {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, problem: "the snapshot is empty" };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, problem: "the snapshot is not JSON" };
  }
}

function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return "invalid";
  const path = issue.path.map(String).join(".");
  return path === "" ? issue.message : `${path}: ${issue.message}`;
}

/** The guard's snapshot from the text `buildLedgerQuery`'s statement printed. */
export function parseLedgerSnapshot(text: string): SnapshotResult<LedgerSnapshot> {
  const json = parseJson(text);
  if (!json.ok) return json;
  const parsed = ledgerSnapshotSchema.safeParse(json.value);
  if (!parsed.success) return { ok: false, problem: `the snapshot is not a ledger snapshot (${describeIssue(parsed.error)})` };
  return { ok: true, value: parsed.data };
}

/** The row counts from the text `buildRowCountQuery(tables)` printed: exactly those tables, a count or null each. */
export function parseRowCountSnapshot(text: string, tables: readonly string[]): SnapshotResult<RowCounts> {
  const json = parseJson(text);
  if (!json.ok) return json;
  const parsed = z.record(z.string(), z.int().nonnegative().nullable()).safeParse(json.value);
  if (!parsed.success) return { ok: false, problem: `the snapshot is not a row-count snapshot (${describeIssue(parsed.error)})` };
  const missing = tables.filter((table) => !Object.hasOwn(parsed.data, table));
  if (missing.length > 0) return { ok: false, problem: `the snapshot has no count of ${missing.join(", ")}` };
  const extra = Object.keys(parsed.data).filter((table) => !tables.includes(table));
  if (extra.length > 0) return { ok: false, problem: `the snapshot counts tables that were not asked for: ${extra.join(", ")}` };
  const counts: RowCounts = {};
  for (const table of tables) counts[table] = parsed.data[table] ?? null;
  return { ok: true, value: counts };
}
