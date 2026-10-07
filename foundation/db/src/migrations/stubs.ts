// Stubs of the app's own tables for the adoption reference schema (issue #170). Module SQL may
// reference an app table (`REFERENCES public.app_users (id)`), which the scratch database the
// reference is built on does not have. `readAppTables` copies, from the live database, every table
// outside the schemas the migrator owns: its columns (type only: no defaults, NOT NULL, checks or
// foreign keys, which can point at things the scratch lacks), its primary key, unique constraints
// and plain unique indexes, plus the enum types of those schemas. Domains, extension types and
// other objects are not copied; a column of such a type is skipped and reported.
import type { MigrationSession } from "./session.js";

/** One DDL statement for the scratch database, with the object it creates for reports. */
export interface StubStatement {
  /** `schema.table`, `schema.table.column`, `schema.table.constraint` or `schema.type`, unquoted. */
  readonly object: string;
  readonly sql: string;
}

/** The app's tables as statements to replay, in a runnable order. */
export interface AppCatalog {
  readonly statements: readonly StubStatement[];
}

// Names come back quoted by Postgres (`quote_ident`, `format('%I')`), so no DDL below concatenates
// a raw identifier. Each query takes the excluded schemas as $1.
const IN_APP_SCHEMA = (alias: string): string =>
  `${alias}.nspname <> ALL($1::text[]) AND ${alias}.nspname <> 'information_schema' AND ${alias}.nspname NOT LIKE 'pg\\_%'`;

const NOT_IN_EXTENSION = (catalog: string, alias: string): string =>
  `NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = '${catalog}'::regclass AND dep.objid = ${alias}.oid AND dep.deptype = 'e')`;

const QUERIES = {
  schemas: `
    SELECT DISTINCT n.nspname AS name, quote_ident(n.nspname) AS quoted
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p') AND ${IN_APP_SCHEMA("n")} AND ${NOT_IN_EXTENSION("pg_class", "c")}
    ORDER BY 1`,
  enums: `
    SELECT n.nspname || '.' || t.typname AS object, format('%I.%I', n.nspname, t.typname) AS quoted,
      (SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid) AS labels
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype = 'e' AND ${IN_APP_SCHEMA("n")} AND ${NOT_IN_EXTENSION("pg_type", "t")}
    ORDER BY 1`,
  tables: `
    SELECT n.nspname || '.' || c.relname AS object, format('%I.%I', n.nspname, c.relname) AS quoted
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p') AND ${IN_APP_SCHEMA("n")} AND ${NOT_IN_EXTENSION("pg_class", "c")}
    ORDER BY 1`,
  columns: `
    SELECT n.nspname || '.' || c.relname AS table_object, format('%I.%I', n.nspname, c.relname) AS table_quoted,
      a.attname AS name, quote_ident(a.attname) AS quoted, format_type(a.atttypid, a.atttypmod) AS type
    FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
      AND ${IN_APP_SCHEMA("n")} AND ${NOT_IN_EXTENSION("pg_class", "c")}
    ORDER BY 1, a.attnum`,
  keys: `
    SELECT n.nspname || '.' || c.relname AS table_object, format('%I.%I', n.nspname, c.relname) AS table_quoted,
      con.conname AS name, quote_ident(con.conname) AS quoted, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype IN ('p', 'u') AND c.relkind IN ('r', 'p')
      AND ${IN_APP_SCHEMA("n")} AND ${NOT_IN_EXTENSION("pg_class", "c")}
    ORDER BY 1, con.contype, 3`,
  // A unique index that backs no key constraint. A foreign key records the index it references in
  // `conindid` too, so only key constraints count.
  uniqueIndexes: `
    SELECT n.nspname || '.' || c.relname AS table_object, i.relname AS name, pg_get_indexdef(i.oid) AS definition
    FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_class c ON c.oid = x.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE x.indisunique AND x.indpred IS NULL AND x.indexprs IS NULL AND c.relkind IN ('r', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = x.indexrelid AND con.contype IN ('p', 'u', 'x'))
      AND ${IN_APP_SCHEMA("n")} AND ${NOT_IN_EXTENSION("pg_class", "c")}
    ORDER BY 1, 2`,
} as const;

interface ColumnRow {
  table_object: string;
  table_quoted: string;
  name: string;
  quoted: string;
  type: string;
}

interface KeyRow {
  table_object: string;
  table_quoted: string;
  name: string;
  quoted: string;
  definition: string;
}

/**
 * The app's tables in every schema except `pg_*`, `information_schema` and `excludedSchemas` (the
 * ledger, the enabled modules' schemas, the app migrator's own). Runs in its own read-only transaction.
 */
export async function readAppTables(session: MigrationSession, excludedSchemas: readonly string[]): Promise<AppCatalog> {
  await session.exec("BEGIN READ ONLY; SET LOCAL search_path = pg_catalog;");
  try {
    const params = [[...excludedSchemas]];
    const schemas = await session.query<{ name: string; quoted: string }>(QUERIES.schemas, params);
    const enums = await session.query<{ object: string; quoted: string; labels: string }>(QUERIES.enums, params);
    const tables = await session.query<{ object: string; quoted: string }>(QUERIES.tables, params);
    const columns = await session.query<ColumnRow>(QUERIES.columns, params);
    const keys = await session.query<KeyRow>(QUERIES.keys, params);
    const indexes = await session.query<{ table_object: string; name: string; definition: string }>(QUERIES.uniqueIndexes, params);
    return {
      statements: [
        ...schemas.map((row) => ({ object: row.name, sql: `CREATE SCHEMA IF NOT EXISTS ${row.quoted}` })),
        ...enums.map((row) => ({ object: row.object, sql: `CREATE TYPE ${row.quoted} AS ENUM (${row.labels})` })),
        ...tables.map((row) => ({ object: row.object, sql: `CREATE TABLE ${row.quoted} ()` })),
        ...columns.map((row) => ({ object: `${row.table_object}.${row.name}`, sql: `ALTER TABLE ${row.table_quoted} ADD COLUMN ${row.quoted} ${row.type}` })),
        ...keys.map((row) => ({ object: `${row.table_object}.${row.name}`, sql: `ALTER TABLE ${row.table_quoted} ADD CONSTRAINT ${row.quoted} ${row.definition}` })),
        ...indexes.map((row) => ({ object: `${row.table_object}.${row.name}`, sql: row.definition })),
      ],
    };
  } finally {
    await session.exec("ROLLBACK");
  }
}

/**
 * Replays the catalog on the scratch database, each statement on its own: a statement that fails
 * (a type the scratch lacks, a key on a skipped column) is skipped, so a module that never
 * references that table still builds its reference. Returns the skipped objects with the reason.
 */
export async function createAppStubs(session: MigrationSession, catalog: AppCatalog): Promise<string[]> {
  const skipped: string[] = [];
  for (const statement of catalog.statements) {
    try {
      await session.exec(statement.sql);
    } catch (error) {
      skipped.push(`${statement.object}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return skipped;
}
