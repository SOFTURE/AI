// Row counts of the app's key tables before and after a deploy. The list comes from the app (FIRE counted
// `users`, `snapshots` and `position_values`); a table that lost rows across the deploy fails the comparison.
import type pg from "pg";
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

export type RowCounts = Record<string, number>;

/** The file `--out` writes and `--compare` reads. */
export const rowCountsFileSchema = z.strictObject({
  takenAt: z.string(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
});

export type RowCountsFile = z.infer<typeof rowCountsFileSchema>;

export async function countRows(client: pg.Client, tables: readonly string[]): Promise<RowCounts> {
  const counts: RowCounts = {};
  for (const table of tables) {
    const quoted = table.split(".").map((part) => `"${part}"`).join(".");
    const result = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${quoted}`);
    counts[table] = Number(result.rows[0]?.count ?? "0");
  }
  return counts;
}

export interface RowCountChange {
  readonly table: string;
  readonly before: number | null;
  readonly after: number;
}

/** Every table of `after` with its earlier count; `lost` holds the tables that shrank or were not counted before. */
export function compareRowCounts(before: RowCounts, after: RowCounts): { changes: RowCountChange[]; lost: RowCountChange[] } {
  const changes = Object.entries(after).map(([table, count]) => ({ table, before: before[table] ?? null, after: count }));
  const lost = changes.filter((change) => change.before === null || change.after < change.before);
  return { changes, lost };
}
