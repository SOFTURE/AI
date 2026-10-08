// Row counts of the app's key tables before and after a deploy. The list comes from the app (an app
// counts `users`, `orders` and `invoices`); a table that lost rows across the deploy fails the comparison. A table
// the old schema lacks counts as absent, so a release can list the table its own migration creates.
import { z } from "zod";

/** `table` or `schema.table`, lower snake case: validated before it is quoted into SQL. */
export const TABLE_NAME_PATTERN = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

export type TableListResult = { ok: true; tables: string[] } | { ok: false; problem: string };

/** `users, billing.subscriptions` → `["users", "billing.subscriptions"]`, unique and in the given order. */
export function parseTableList(text: string): TableListResult {
  const tables = [...new Set(text.split(",").map((name) => name.trim()).filter((name) => name !== ""))];
  if (tables.length === 0) {
    return { ok: false, problem: "no table given; pass --tables=users,billing.subscriptions" };
  }
  const invalid = tables.filter((name) => !TABLE_NAME_PATTERN.test(name));
  if (invalid.length > 0) {
    return { ok: false, problem: `not a table name (table or schema.table, lower snake case): ${invalid.join(", ")}` };
  }
  return { ok: true, tables };
}

/** A table's row count, or `null` when the database lacked the table (a release may create it). */
export type RowCounts = Record<string, number | null>;

/** The file `--out` writes and `--compare` reads. */
export const rowCountsFileSchema = z.strictObject({
  takenAt: z.string(),
  counts: z.record(z.string(), z.number().int().nonnegative().nullable()),
});

export type RowCountsFile = z.infer<typeof rowCountsFileSchema>;

/** What `countRows` needs of a client: `pg.Client` and PGlite both have it. */
export interface Queryable {
  query<Row>(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

/** Counts each table that exists; one the database lacks (`to_regclass` finds nothing) is `null`. */
export async function countRows(client: Queryable, tables: readonly string[]): Promise<RowCounts> {
  const counts: RowCounts = {};
  for (const table of tables) {
    const quoted = table.split(".").map((part) => `"${part}"`).join(".");
    const found = await client.query<{ present: boolean }>("SELECT to_regclass($1) IS NOT NULL AS present", [quoted]);
    if (found.rows[0]?.present !== true) {
      counts[table] = null;
      continue;
    }
    const result = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${quoted}`);
    counts[table] = Number(result.rows[0]?.count ?? "0");
  }
  return counts;
}

/**
 * One table of the comparison: `counted` both times (fails on a drop), `new` (absent before, counted after: the
 * release created it), `absent` after the deploy (fails), `uncounted` (not in the earlier file: fails).
 */
export type RowCountChange =
  | { readonly kind: "counted"; readonly table: string; readonly before: number; readonly after: number }
  | { readonly kind: "new"; readonly table: string; readonly after: number }
  | { readonly kind: "absent"; readonly table: string; readonly before: number | null }
  | { readonly kind: "uncounted"; readonly table: string; readonly after: number };

function compareTable(table: string, before: RowCounts, after: number | null): RowCountChange {
  const earlier = Object.hasOwn(before, table) ? before[table] : undefined;
  if (after === null) return { kind: "absent", table, before: earlier ?? null };
  if (earlier === undefined) return { kind: "uncounted", table, after };
  if (earlier === null) return { kind: "new", table, after };
  return { kind: "counted", table, before: earlier, after };
}

function isRowCountLoss(change: RowCountChange): boolean {
  return change.kind === "counted" ? change.after < change.before : change.kind !== "new";
}

/** Every table of `after` against the earlier counts; `lost` holds the ones that fail the deploy. */
export function compareRowCounts(before: RowCounts, after: RowCounts): { changes: RowCountChange[]; lost: RowCountChange[] } {
  const changes = Object.entries(after).map(([table, count]) => compareTable(table, before, count));
  return { changes, lost: changes.filter(isRowCountLoss) };
}

const LOSS_REASONS: Record<RowCountChange["kind"], string> = {
  counted: "fewer rows than before",
  new: "created by this release",
  absent: "absent after the deploy",
  uncounted: "not counted before",
};

/** The line `row-counts --compare` prints for a table, without the `row-counts: ` prefix. */
export function formatRowCountChange(change: RowCountChange): string {
  switch (change.kind) {
    case "counted":
      return `${change.table} ${change.before} -> ${change.after} (${formatDelta(change.after - change.before)})`;
    case "new":
      return `${change.table} absent -> ${change.after} (created by this release)`;
    case "absent":
      return `${change.table} ${change.before ?? "absent"} -> absent`;
    case "uncounted":
      return `${change.table} ${change.after} (not counted before)`;
  }
}

/** `notes (absent after the deploy)`: a failing table with its reason, for the failure line. */
export function formatRowCountLoss(change: RowCountChange): string {
  return `${change.table} (${LOSS_REASONS[change.kind]})`;
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
