// The database steps without a connection from the host: the CLI prints the SQL, `psql` runs it where the database
// is (`docker compose exec -T postgres psql …`), and the CLI reads psql's output back. The output is one JSON line;
// the parsers take the last line that starts with `{`, so psql's own notices around it do not matter.
import type { JournalRow } from "@softure-ai/db";
import { z } from "zod";
import { quoteTableName, type AppLedgerRow } from "./app-ledger.js";
import type { RowCounts } from "./row-counts.js";

/** A literal for SQL from a name `TABLE_NAME_PATTERN` (or `quoteTableName`) allowed: it holds no single quote. */
function toLiteral(text: string): string {
  if (text.includes("'")) throw new Error(`toLiteral: a quote in ${text}`);
  return `'${text}'`;
}

/**
 * A psql script whose output is `{"softure":[…],"app":[…]}`: the rows of `softure.migrations` and, with `appLedger`,
 * of that table; a ledger table that does not exist yet reads as no rows (`\if`, psql 10 or newer).
 */
export function buildLedgerSql(appLedger: string | null): string {
  const lines = [
    "-- Written by softure-deploy schema-guard --print-sql; run with psql, read back with --ledger-file.",
    "\\set ON_ERROR_STOP on",
    "SELECT to_regclass('softure.migrations') IS NOT NULL AS softure_ledger \\gset",
    "\\if :softure_ledger",
    "SELECT coalesce(json_agg(json_build_object('module', module, 'version', version, 'name', name, 'checksum', checksum, 'method', method) ORDER BY id), '[]')::text AS softure_rows FROM softure.migrations \\gset",
    "\\else",
    "\\set softure_rows '[]'",
    "\\endif",
  ];
  if (appLedger === null) {
    lines.push("SELECT json_build_object('softure', :'softure_rows'::json);");
    return `${lines.join("\n")}\n`;
  }
  const quoted = quoteTableName(appLedger);
  lines.push(
    `SELECT to_regclass(${toLiteral(quoted)}) IS NOT NULL AS app_ledger \\gset`,
    "\\if :app_ledger",
    `SELECT coalesce(json_agg(json_build_object('hash', hash, 'created_at', created_at::text) ORDER BY created_at), '[]')::text AS app_rows FROM ${quoted} \\gset`,
    "\\else",
    "\\set app_rows '[]'",
    "\\endif",
    "SELECT json_build_object('softure', :'softure_rows'::json, 'app', :'app_rows'::json);",
  );
  return `${lines.join("\n")}\n`;
}

/**
 * One statement whose output is `{"<table>": <rows or null>, …}` in the given order: a table counts only when
 * `to_regclass` finds it (`query_to_xml` runs the count inside the statement), else it is `null`.
 */
export function buildRowCountsSql(tables: readonly string[]): string {
  const names = tables.map(toLiteral).join(", ");
  const quoted = tables.map((table) => toLiteral(quoteTableName(table))).join(", ");
  return [
    "-- Written by softure-deploy row-counts --print-sql; run with psql, read back with --counts-file.",
    "SELECT coalesce(json_object_agg(t.name, CASE WHEN to_regclass(t.quoted) IS NULL THEN NULL",
    "  ELSE (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %s', to_regclass(t.quoted)), false, true, '')))[1]::text::bigint END",
    "  ORDER BY t.ord), '{}')::text",
    `FROM unnest(ARRAY[${names}]::text[], ARRAY[${quoted}]::text[]) WITH ORDINALITY AS t(name, quoted, ord);`,
    "",
  ].join("\n");
}

export type ParsedOutput<T> = { ok: true; value: T } | { ok: false; problem: string };

function readJsonLine(text: string): ParsedOutput<unknown> {
  const line = text
    .split("\n")
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.startsWith("{"))
    .at(-1);
  if (line === undefined) return { ok: false, problem: "it holds no JSON line (did psql run the --print-sql output?)" };
  try {
    return { ok: true, value: JSON.parse(line) };
  } catch {
    return { ok: false, problem: "its JSON line is not valid JSON" };
  }
}

const journalRowSchema = z.strictObject({
  module: z.string(),
  version: z.number().int(),
  name: z.string(),
  checksum: z.string(),
  method: z.enum(["applied", "adopted"]),
});

const appRowSchema = z.strictObject({
  hash: z.string(),
  created_at: z.union([z.string().regex(/^\d+$/), z.number().int()]),
});

const ledgerOutputSchema = z.strictObject({
  softure: z.array(journalRowSchema),
  app: z.array(appRowSchema).optional(),
});

export interface LedgerOutput {
  readonly softure: JournalRow[];
  /** null when the output carries no app ledger (printed without `--app-ledger`). */
  readonly app: AppLedgerRow[] | null;
}

/** The output of `buildLedgerSql`'s script. */
export function parseLedgerOutput(text: string): ParsedOutput<LedgerOutput> {
  const json = readJsonLine(text);
  if (!json.ok) return json;
  const parsed = ledgerOutputSchema.safeParse(json.value);
  if (!parsed.success) return { ok: false, problem: `it is not the ledger output: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  const app = parsed.data.app?.map((row) => ({ hash: row.hash, createdAt: Number(row.created_at) })) ?? null;
  return { ok: true, value: { softure: parsed.data.softure, app } };
}

const countsOutputSchema = z.record(z.string(), z.number().int().nonnegative().nullable());

/** The output of `buildRowCountsSql`, which must hold exactly `tables`: a stale SQL file would count others. */
export function parseRowCountsOutput(text: string, tables: readonly string[]): ParsedOutput<RowCounts> {
  const json = readJsonLine(text);
  if (!json.ok) return json;
  const parsed = countsOutputSchema.safeParse(json.value);
  if (!parsed.success) return { ok: false, problem: `it is not the row-counts output: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  const counted = Object.keys(parsed.data);
  const missing = tables.filter((table) => !Object.hasOwn(parsed.data, table));
  const extra = counted.filter((table) => !tables.includes(table));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`missing ${missing.join(", ")}`);
    if (extra.length > 0) parts.push(`not listed ${extra.join(", ")}`);
    return { ok: false, problem: `it counts other tables than the list (${parts.join("; ")})` };
  }
  const counts: RowCounts = {};
  for (const table of tables) counts[table] = parsed.data[table] ?? null;
  return { ok: true, value: counts };
}
