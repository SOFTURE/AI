// A comparable description of one schema, for `adoptModule`: one line per object, sorted. Read
// from pg_catalog with `search_path = pg_catalog`, so every name in a definition is printed
// schema-qualified and two databases print the same object the same way.
//
// Left out on purpose: dropped columns (`attisdropped`), objects that belong to an extension
// (`pg_depend.deptype = 'e'`), NOT NULL rows of pg_constraint (PG 18 has them, PG 16 does not;
// nullability is compared through `attnotnull`), grants, comments, column order, row-level
// security policies and view bodies.
import type { MigrationSession } from "./session.js";

const NOT_IN_EXTENSION = (catalog: string, alias: string): string =>
  `NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = '${catalog}'::regclass AND dep.objid = ${alias}.oid AND dep.deptype = 'e')`;

const RELATION_KINDS: Readonly<Record<string, string>> = {
  r: "table",
  p: "partitioned table",
  v: "view",
  m: "materialized view",
  S: "sequence",
  f: "foreign table",
};

const QUERIES = {
  relations: `
    SELECT c.relname, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f') AND ${NOT_IN_EXTENSION("pg_class", "c")}`,
  columns: `
    SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null,
      pg_get_expr(d.adbin, d.adrelid) AS default_expr, a.attidentity AS identity, a.attgenerated AS generated
    FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm', 'f') AND a.attnum > 0 AND NOT a.attisdropped
      AND ${NOT_IN_EXTENSION("pg_class", "c")}`,
  constraints: `
    SELECT c.relname, con.conname, pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND con.contype IN ('p', 'u', 'f', 'c', 'x')`,
  indexes: `
    SELECT i.relname, pg_get_indexdef(i.oid) AS definition
    FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_namespace n ON n.oid = i.relnamespace
    WHERE n.nspname = $1 AND ${NOT_IN_EXTENSION("pg_class", "i")}`,
  triggers: `
    SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid, true) AS definition
    FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND NOT t.tgisinternal`,
  functions: `
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS signature,
      md5(pg_get_functiondef(p.oid)) AS definition_hash
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $1 AND p.prokind IN ('f', 'p') AND ${NOT_IN_EXTENSION("pg_proc", "p")}`,
  types: `
    SELECT t.typname, t.typtype,
      CASE t.typtype
        WHEN 'e' THEN (SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid)
        WHEN 'd' THEN format_type(t.typbasetype, t.typtypmod)
      END AS definition
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = $1 AND t.typtype IN ('e', 'd') AND ${NOT_IN_EXTENSION("pg_type", "t")}`,
} as const;

interface ColumnRow {
  relname: string;
  attname: string;
  type: string;
  not_null: boolean;
  default_expr: string | null;
  identity: string;
  generated: string;
}

/** Every object of `schema` as one sorted line each. Runs in its own read-only transaction. */
export async function describeSchema(session: MigrationSession, schema: string): Promise<string[]> {
  await session.exec("BEGIN READ ONLY; SET LOCAL search_path = pg_catalog;");
  try {
    const lines = [
      ...(await session.query<{ relname: string; relkind: string }>(QUERIES.relations, [schema])).map(
        (row) => `${RELATION_KINDS[row.relkind] ?? row.relkind} ${schema}.${row.relname}`,
      ),
      ...(await session.query<ColumnRow>(QUERIES.columns, [schema])).map((row) => describeColumn(schema, row)),
      ...(await session.query<{ relname: string; conname: string; definition: string }>(QUERIES.constraints, [schema])).map(
        (row) => `constraint ${schema}.${row.relname}.${row.conname}: ${row.definition}`,
      ),
      ...(await session.query<{ relname: string; definition: string }>(QUERIES.indexes, [schema])).map(
        (row) => `index ${schema}.${row.relname}: ${row.definition}`,
      ),
      ...(await session.query<{ relname: string; tgname: string; definition: string }>(QUERIES.triggers, [schema])).map(
        (row) => `trigger ${schema}.${row.relname}.${row.tgname}: ${row.definition}`,
      ),
      ...(await session.query<{ signature: string; definition_hash: string }>(QUERIES.functions, [schema])).map(
        (row) => `function ${schema}.${row.signature}: body ${row.definition_hash}`,
      ),
      ...(await session.query<{ typname: string; typtype: string; definition: string | null }>(QUERIES.types, [schema])).map(
        (row) => `${row.typtype === "e" ? "enum" : "domain"} ${schema}.${row.typname}: ${row.definition ?? ""}`,
      ),
    ];
    return lines.sort();
  } finally {
    await session.exec("ROLLBACK");
  }
}

/** What is in `expected` and not in `actual`, and the other way round, as readable lines. */
export function diffSchemas(expected: readonly string[], actual: readonly string[]): string[] {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return [
    ...expected.filter((line) => !actualSet.has(line)).map((line) => `missing in database: ${line}`),
    ...actual.filter((line) => !expectedSet.has(line)).map((line) => `unexpected in database: ${line}`),
  ];
}

function describeColumn(schema: string, row: ColumnRow): string {
  const parts = [`column ${schema}.${row.relname}.${row.attname} ${row.type}`];
  if (row.not_null) parts.push("not null");
  if (row.generated === "s" || row.generated === "v") {
    parts.push(`generated as ${row.default_expr ?? ""}${row.generated === "s" ? " stored" : " virtual"}`);
  } else if (row.default_expr !== null) {
    parts.push(`default ${row.default_expr}`);
  }
  if (row.identity === "a") parts.push("identity always");
  if (row.identity === "d") parts.push("identity by default");
  return parts.join(" ");
}
