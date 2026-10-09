// Copying one account, with every row it owns, from one database to another (an app moving an
// account between environments or instances). The rows are found through the source database's
// foreign keys, not a table list, so a new module or app table is covered by its foreign key.
// Values travel as text with their column type, so nothing is rounded (`timestamptz` keeps its
// microseconds) and NULL stays NULL. The copy is verified before it is kept, and a dry run by default.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { findDriverError, type Queryable } from "@softure-ai/db";
import { sql, type SQL } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getEmailKey } from "./consents.js";

export type CopyAccountErrorCode =
  | "privacy.copy_account_missing"
  | "privacy.copy_account_exists"
  | "privacy.copy_schema_mismatch"
  | "privacy.copy_unsupported"
  | "privacy.copy_reference_missing"
  | "privacy.copy_conflict"
  | "privacy.copy_verification_failed";

/** A table the foreign keys do not reach, added by a column holding the account's id or email. */
export interface CopyAccountInclude {
  /** `schema.table`, e.g. `waitlist.signups`. */
  readonly table: string;
  readonly column: string;
  /** What the column holds: the account's id, or its email (compared trimmed and lowercased). */
  readonly matches: "userId" | "email";
}

export interface CopyAccountInput {
  /** The database to read from; only read, in one repeatable-read, read-only transaction. */
  readonly from: Queryable;
  /** The database to write to, in one transaction. */
  readonly to: Queryable;
  readonly userId: string;
  /** False (default): a dry run. Everything runs and is verified in the target, then rolled back. */
  readonly commit?: boolean;
  /** `schema.table` names to leave out, e.g. `auth.sessions`; tables reached only through them are left out too. */
  readonly exclude?: readonly string[];
  /** Tables to add that no foreign key ties to the account, e.g. `waitlist.signups` by `email`. */
  readonly include?: readonly CopyAccountInclude[];
  /**
   * A copied row may mention a row the copy does not carry (an admin who granted something, under
   * a foreign key with ON DELETE SET NULL). "refuse" (default) fails the copy when the target lacks
   * that row; "null" writes such a key as NULL, what deleting that row in the target would do.
   * Any other missing reference always refuses.
   */
  readonly onMissingReference?: "refuse" | "null";
}

export interface CopiedTable {
  /** `schema.table`. */
  readonly table: string;
  readonly rows: number;
  /** Rows written with a mention set to NULL (`onMissingReference: "null"`). */
  readonly nulledReferences: number;
}

export interface CopyAccountReport {
  /** False for a dry run: the target was left as it was. */
  readonly committed: boolean;
  readonly userId: string;
  /** Every table the account reaches, in insert order, also those with no rows. */
  readonly tables: readonly CopiedTable[];
}

/** A refusal, with what failed: the table, column, constraint or row it is about. */
export type CopyAccountFailure = Err<CopyAccountErrorCode> & { readonly detail: string };

export type CopyAccountResult = Ok<CopyAccountReport> | CopyAccountFailure;

interface Column {
  readonly name: string;
  readonly type: string;
  readonly isGenerated: boolean;
  readonly isIdentity: boolean;
  readonly isSerial: boolean;
  readonly isNullable: boolean;
}

interface Table {
  readonly key: string;
  readonly schema: string;
  readonly name: string;
  readonly columns: readonly Column[];
  readonly primaryKey: readonly string[];
}

interface ForeignKey {
  readonly name: string;
  readonly child: string;
  readonly parent: string;
  readonly columns: readonly string[];
  readonly parentColumns: readonly string[];
  /** `pg_constraint.confdeltype`: a no action, r restrict, c cascade, n set null, d set default. */
  readonly onDelete: string;
}

interface Catalog {
  readonly tables: ReadonlyMap<string, Table>;
  readonly foreignKeys: readonly ForeignKey[];
}

/** One table's part of the copy: the columns written and the rows as text (null for NULL). */
interface TableCopy {
  readonly table: Table;
  readonly columns: readonly Column[];
  readonly rows: (string | null)[][];
  /** The selection of the table's rows; the target is read back with it too. */
  readonly predicate: SQL;
  nulledReferences: number;
}

/** Owning edges: deleting the parent row removes (CASCADE) or is blocked by (RESTRICT, NO ACTION) the child row. */
const OWNING_ACTIONS = new Set(["a", "r", "c"]);
const SET_NULL = "n";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNTS = getTableConfig(users);
const ACCOUNTS_KEY = `${ACCOUNTS.schema ?? "public"}.${ACCOUNTS.name}`;
const CONSENTS_KEY = "privacy.consents";
/** SQLSTATE class 23: integrity constraint violations (unique, foreign key, check, not null). */
const INTEGRITY_VIOLATION_CLASS = "23";

class CopyRefusal extends Error {
  constructor(
    readonly code: CopyAccountErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "CopyRefusal";
  }
}

/** Thrown at the end of a dry run to roll the target back, carrying the report. */
class DryRunRollback extends Error {
  constructor(readonly report: CopyAccountReport) {
    super("dry run");
    this.name = "DryRunRollback";
  }
}

/**
 * Copies the account `userId` and every row it owns from `from` to `to`. Owned rows are the
 * account's `auth.users` row, every row that references an owned row through a foreign key whose
 * ON DELETE is CASCADE, RESTRICT or NO ACTION (what deleting the account removes or is blocked by),
 * transitively, the account's email-keyed consents, and `include`. A table's foreign key to itself
 * is not followed. Expected failures are returned with `detail`; nothing is written then. Thrown
 * errors (a lost connection) propagate after the rollback.
 */
export async function copyAccount(input: CopyAccountInput): Promise<CopyAccountResult> {
  try {
    const copies = await readAccount(input);
    const report = await writeAccount(input, copies);
    return ok(report);
  } catch (error) {
    if (error instanceof DryRunRollback) return ok(error.report);
    if (error instanceof CopyRefusal) return { ...err(error.code), detail: error.detail };
    throw error;
  }
}

async function readAccount(input: CopyAccountInput): Promise<TableCopy[]> {
  if (!UUID.test(input.userId)) throw new CopyRefusal("privacy.copy_account_missing", `"${input.userId}" is not an account id`);
  return input.from.transaction(
    async (tx) => {
      await setTextSettings(tx);
      const catalog = await readCatalog(tx);
      const email = await findAccountEmail(tx, input.userId);
      if (email === null) throw new CopyRefusal("privacy.copy_account_missing", `${ACCOUNTS_KEY} has no row with id ${input.userId}`);
      const predicates = buildPredicates(catalog, input, email);
      const order = orderForInsert(catalog, [...predicates.keys()]);
      const referenced = findReferencedColumns(catalog);
      const copies: TableCopy[] = [];
      for (const key of order) {
        const table = getTable(catalog, key);
        const predicate = predicates.get(key);
        if (predicate === undefined) continue;
        const columns = table.columns.filter((column) => !column.isGenerated && !isRegeneratedKey(table, column, referenced));
        copies.push({ table, columns, rows: await selectRows(tx, table, columns, predicate), predicate, nulledReferences: 0 });
      }
      return copies;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

async function writeAccount(input: CopyAccountInput, copies: readonly TableCopy[]): Promise<CopyAccountReport> {
  const isCommitting = input.commit === true;
  return input.to.transaction(async (tx) => {
    await setTextSettings(tx);
    await refuseExistingAccount(tx, input.userId, findCopiedEmail(copies));
    const target = await readCatalog(tx);
    for (const copy of copies) checkTargetTable(target, copy);
    await settleReferences(tx, input, target, copies);
    for (const copy of copies) await insertRows(tx, target, copy);
    for (const copy of copies) await verifyRows(tx, target, copy);
    if (isCommitting) for (const copy of copies) await advanceSequences(tx, target, copy);
    const report: CopyAccountReport = {
      committed: isCommitting,
      userId: input.userId,
      tables: copies.map((copy) => ({ table: copy.table.key, rows: copy.rows.length, nulledReferences: copy.nulledReferences })),
    };
    if (!isCommitting) throw new DryRunRollback(report);
    return report;
  });
}

/** Text forms that do not depend on the server's or the session's settings. */
async function setTextSettings(db: Queryable): Promise<void> {
  await db.execute(sql`SET LOCAL TimeZone = 'UTC'`);
  await db.execute(sql`SET LOCAL DateStyle = 'ISO, YMD'`);
  await db.execute(sql`SET LOCAL IntervalStyle = 'postgres'`);
  await db.execute(sql`SET LOCAL extra_float_digits = 1`);
}

async function readCatalog(db: Queryable): Promise<Catalog> {
  const columns = await db.execute<{
    schema: string;
    table: string;
    column: string;
    type: string;
    is_generated: boolean;
    is_identity: boolean;
    is_serial: boolean;
    is_nullable: boolean;
  }>(sql`
    SELECT n.nspname AS schema, c.relname AS table, a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type,
      a.attgenerated <> '' AS is_generated, a.attidentity <> '' AS is_identity,
      coalesce(pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval(%', false) AS is_serial, NOT a.attnotnull AS is_nullable
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition
      AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_%'
    ORDER BY n.nspname, c.relname, a.attnum
  `);
  const primaryKeys = await db.execute<{ schema: string; table: string; columns: string[] }>(sql`
    SELECT n.nspname AS schema, c.relname AS table,
      ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY AS k(num, ord)
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.num ORDER BY k.ord) AS columns
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'p'
  `);
  const foreignKeys = await db.execute<{
    name: string;
    child_schema: string;
    child_table: string;
    parent_schema: string;
    parent_table: string;
    columns: string[];
    parent_columns: string[];
    on_delete: string;
  }>(sql`
    SELECT con.conname AS name, cn.nspname AS child_schema, cc.relname AS child_table,
      pn.nspname AS parent_schema, pc.relname AS parent_table, con.confdeltype::text AS on_delete,
      ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY AS k(num, ord)
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.num ORDER BY k.ord) AS columns,
      ARRAY(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY AS k(num, ord)
        JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.num ORDER BY k.ord) AS parent_columns
    FROM pg_constraint con
    JOIN pg_class cc ON cc.oid = con.conrelid
    JOIN pg_namespace cn ON cn.oid = cc.relnamespace
    JOIN pg_class pc ON pc.oid = con.confrelid
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace
    WHERE con.contype = 'f' AND NOT cc.relispartition
    ORDER BY cn.nspname, cc.relname, con.conname
  `);

  const pkByTable = new Map(primaryKeys.rows.map((row) => [`${row.schema}.${row.table}`, row.columns]));
  const tables = new Map<string, Table & { readonly columns: Column[] }>();
  for (const row of columns.rows) {
    const key = `${row.schema}.${row.table}`;
    const table = tables.get(key) ?? { key, schema: row.schema, name: row.table, columns: [], primaryKey: pkByTable.get(key) ?? [] };
    table.columns.push({
      name: row.column,
      type: row.type,
      isGenerated: row.is_generated,
      isIdentity: row.is_identity,
      isSerial: row.is_serial,
      isNullable: row.is_nullable,
    });
    tables.set(key, table);
  }
  return {
    tables,
    foreignKeys: foreignKeys.rows.map((row) => ({
      name: row.name,
      child: `${row.child_schema}.${row.child_table}`,
      parent: `${row.parent_schema}.${row.parent_table}`,
      columns: row.columns,
      parentColumns: row.parent_columns,
      onDelete: row.on_delete,
    })),
  };
}

async function findAccountEmail(db: Queryable, userId: string): Promise<string | null> {
  const result = await db.execute<{ email: string }>(
    sql`SELECT email FROM ${identifier(ACCOUNTS.schema ?? "public")}.${identifier(ACCOUNTS.name)} WHERE id = ${userId}::uuid`,
  );
  return result.rows[0]?.email ?? null;
}

/**
 * The selection of every copied table: the rows of the account, the rows the include list adds,
 * the account's email-keyed consents, and the rows referencing a selected row through an owning
 * foreign key, as nested `IN (SELECT ...)` predicates. Unknown names in `exclude` or `include` refuse.
 */
function buildPredicates(catalog: Catalog, input: CopyAccountInput, email: string): Map<string, SQL> {
  const excluded = new Set(input.exclude ?? []);
  for (const key of [...excluded, ...(input.include ?? []).map((entry) => entry.table)]) getTable(catalog, key);
  const roots = new Map<string, SQL[]>();
  const addRoot = (key: string, condition: SQL) => roots.set(key, [...(roots.get(key) ?? []), condition]);

  addRoot(ACCOUNTS_KEY, sql`${identifier("id")} = ${input.userId}::uuid`);
  const consents = catalog.tables.get(CONSENTS_KEY);
  if (consents?.columns.some((column) => column.name === "email_key") === true) {
    addRoot(CONSENTS_KEY, sql`${identifier("email_key")} = ${getEmailKey(email)}`);
  }
  for (const entry of input.include ?? []) {
    const table = getTable(catalog, entry.table);
    if (!table.columns.some((column) => column.name === entry.column)) {
      throw new CopyRefusal("privacy.copy_schema_mismatch", `${entry.table}.${entry.column} is not a column in the source`);
    }
    const column = sql`${identifier(entry.column)}::text`;
    addRoot(entry.table, entry.matches === "userId" ? sql`${column} = ${input.userId}` : sql`lower(btrim(${column})) = ${email.trim().toLowerCase()}`);
  }

  // Reach every table owned through foreign keys, from the roots, skipping excluded tables.
  const reached = new Set([...roots.keys()].filter((key) => !excluded.has(key)));
  const owning = catalog.foreignKeys.filter((key) => OWNING_ACTIONS.has(key.onDelete) && key.child !== key.parent);
  for (let isGrowing = true; isGrowing; ) {
    isGrowing = false;
    for (const key of owning) {
      if (reached.has(key.parent) && !reached.has(key.child) && !excluded.has(key.child)) {
        reached.add(key.child);
        isGrowing = true;
      }
    }
  }
  refuseCycle(
    [...reached],
    owning.filter((key) => reached.has(key.child) && reached.has(key.parent)),
  );

  const predicates = new Map<string, SQL>();
  const build = (key: string): SQL => {
    const built = predicates.get(key);
    if (built !== undefined) return built;
    const conditions = [...(roots.get(key) ?? [])];
    for (const foreignKey of owning) {
      if (foreignKey.child !== key || !reached.has(foreignKey.parent)) continue;
      const parent = getTable(catalog, foreignKey.parent);
      conditions.push(
        sql`(${columnList(foreignKey.columns)}) IN (SELECT ${columnList(foreignKey.parentColumns)} FROM ${tableName(parent)} WHERE ${build(foreignKey.parent)})`,
      );
    }
    const predicate = sql`(${sql.join(conditions, sql` OR `)})`;
    predicates.set(key, predicate);
    return predicate;
  };
  for (const key of reached) build(key);
  return predicates;
}

/** Dependency order over every foreign key between the copied tables (parents first), ties by name. */
function orderForInsert(catalog: Catalog, keys: readonly string[]): string[] {
  const copied = new Set(keys);
  const edges = catalog.foreignKeys.filter((key) => copied.has(key.child) && copied.has(key.parent) && key.child !== key.parent);
  refuseCycle(keys, edges);
  const order: string[] = [];
  const remaining = new Set(keys);
  while (remaining.size > 0) {
    const ready = [...remaining].filter((key) => !edges.some((edge) => edge.child === key && remaining.has(edge.parent))).sort();
    // refuseCycle has run, so some table is always ready; the account table goes first among them.
    const next = ready.includes(ACCOUNTS_KEY) ? ACCOUNTS_KEY : (ready[0] as string);
    order.push(next);
    remaining.delete(next);
  }
  return order;
}

function refuseCycle(keys: readonly string[], edges: readonly ForeignKey[]): void {
  const remaining = new Set(keys);
  for (let isShrinking = true; isShrinking; ) {
    isShrinking = false;
    for (const key of remaining) {
      if (!edges.some((edge) => edge.child === key && edge.parent !== key && remaining.has(edge.parent))) {
        remaining.delete(key);
        isShrinking = true;
      }
    }
  }
  if (remaining.size > 0) {
    throw new CopyRefusal("privacy.copy_unsupported", `the foreign keys between ${[...remaining].sort().join(", ")} form a cycle`);
  }
}

/** Every column some foreign key references, as `schema.table.column`. */
function findReferencedColumns(catalog: Catalog): Set<string> {
  return new Set(catalog.foreignKeys.flatMap((key) => key.parentColumns.map((column) => `${key.parent}.${column}`)));
}

/**
 * A generated single-column primary key (identity or serial) that nothing references: the target
 * assigns its own, since a copied value could collide with the target's rows.
 */
function isRegeneratedKey(table: Table, column: Column, referenced: ReadonlySet<string>): boolean {
  return (
    (column.isIdentity || column.isSerial) &&
    table.primaryKey.length === 1 &&
    table.primaryKey[0] === column.name &&
    !referenced.has(`${table.key}.${column.name}`)
  );
}

async function selectRows(db: Queryable, table: Table, columns: readonly Column[], predicate: SQL): Promise<(string | null)[][]> {
  // Primary key order, so keys the target assigns follow the source's order.
  const orderBy = table.primaryKey.length > 0 ? sql` ORDER BY ${columnList(table.primaryKey)}` : sql``;
  const result = await db.execute<Record<string, string | null>>(sql`SELECT ${selectText(columns)} FROM ${tableName(table)} WHERE ${predicate}${orderBy}`);
  return result.rows.map((row) => columns.map((_, index) => row[`c${String(index)}`] ?? null));
}

async function refuseExistingAccount(db: Queryable, userId: string, email: string | null): Promise<void> {
  const result = await db.execute<{ id: string; email: string }>(
    sql`SELECT id::text AS id, email FROM ${identifier(ACCOUNTS.schema ?? "public")}.${identifier(ACCOUNTS.name)} WHERE id = ${userId}::uuid OR email = ${email}`,
  );
  const [existing] = result.rows;
  if (existing === undefined) return;
  const what = existing.id === userId ? `id ${userId}` : `email ${existing.email}`;
  throw new CopyRefusal("privacy.copy_account_exists", `the target's ${ACCOUNTS_KEY} already has an account with ${what}`);
}

/** The target must have every copied table and column, with the same type, and none of them generated. */
function checkTargetTable(target: Catalog, copy: TableCopy): void {
  const table = target.tables.get(copy.table.key);
  if (table === undefined) throw new CopyRefusal("privacy.copy_schema_mismatch", `${copy.table.key} is missing in the target`);
  for (const column of copy.columns) {
    const found = table.columns.find((candidate) => candidate.name === column.name);
    const where = `${copy.table.key}.${column.name}`;
    if (found === undefined) throw new CopyRefusal("privacy.copy_schema_mismatch", `${where} is missing in the target`);
    if (found.type !== column.type) {
      throw new CopyRefusal("privacy.copy_schema_mismatch", `${where} is ${found.type} in the target and ${column.type} in the source`);
    }
    if (found.isGenerated) throw new CopyRefusal("privacy.copy_schema_mismatch", `${where} is a generated column in the target`);
  }
}

/**
 * Every foreign key value of a copied row must name a row the copy carries or the target holds.
 * Otherwise the copy refuses, or, for a SET NULL key with `onMissingReference: "null"`, the key is
 * written as NULL.
 */
async function settleReferences(db: Queryable, input: CopyAccountInput, target: Catalog, copies: readonly TableCopy[]): Promise<void> {
  const copiesByTable = new Map(copies.map((copy) => [copy.table.key, copy]));
  for (const copy of copies) {
    const nulledRows = new Set<number>();
    for (const foreignKey of findForeignKeysOf(target, copy.table.key)) {
      const positions = foreignKey.columns.map((name) => copy.columns.findIndex((column) => column.name === name));
      // A key over a column the target assigns (or a generated one) is not written, so not checked.
      if (positions.some((position) => position < 0)) continue;
      const tuples = new Map<string, (string | null)[]>();
      copy.rows.forEach((row) => {
        const tuple = positions.map((position) => row[position] ?? null);
        if (tuple.every((value) => value !== null)) tuples.set(JSON.stringify(tuple), tuple);
      });
      const carried = copiesByTable.get(foreignKey.parent);
      if (carried !== undefined) {
        const parentPositions = foreignKey.parentColumns.map((name) => carried.columns.findIndex((column) => column.name === name));
        for (const row of carried.rows) tuples.delete(JSON.stringify(parentPositions.map((position) => row[position] ?? null)));
      }
      if (tuples.size === 0) continue;
      const missing = await findMissingRows(db, target, foreignKey, [...tuples.values()]);
      if (missing.size === 0) continue;

      const where = `${copy.table.key}.${foreignKey.columns.join(", ")}`;
      const canNull =
        input.onMissingReference === "null" &&
        foreignKey.onDelete === SET_NULL &&
        positions.every((position) => target.tables.get(copy.table.key)?.columns.find((column) => column.name === copy.columns[position]?.name)?.isNullable === true);
      if (!canNull) {
        throw new CopyRefusal(
          "privacy.copy_reference_missing",
          `${where} references ${String(missing.size)} row(s) of ${foreignKey.parent} the target lacks (${foreignKey.name})`,
        );
      }
      copy.rows.forEach((row, index) => {
        if (!missing.has(JSON.stringify(positions.map((position) => row[position] ?? null)))) return;
        for (const position of positions) row[position] = null;
        nulledRows.add(index);
      });
    }
    copy.nulledReferences = nulledRows.size;
  }
}

function findForeignKeysOf(catalog: Catalog, key: string): ForeignKey[] {
  return catalog.foreignKeys.filter((foreignKey) => foreignKey.child === key);
}

/** The tuples (as JSON) the target's parent table has no row for. */
async function findMissingRows(db: Queryable, target: Catalog, foreignKey: ForeignKey, tuples: readonly (string | null)[][]): Promise<Set<string>> {
  const parent = getTable(target, foreignKey.parent, "target");
  const matches = foreignKey.parentColumns.map((name, index) => {
    const type = parent.columns.find((column) => column.name === name)?.type ?? "text";
    return sql`p.${identifier(name)} = (r->>${sql.raw(String(index))})::${sql.raw(type)}`;
  });
  const result = await db.execute<{ tuple: string }>(sql`
    SELECT r::text AS tuple FROM json_array_elements(${JSON.stringify(tuples)}::json) AS r
    WHERE NOT EXISTS (SELECT 1 FROM ${tableName(parent)} AS p WHERE ${sql.join(matches, sql` AND `)})
  `);
  return new Set(result.rows.map((row) => JSON.stringify(JSON.parse(row.tuple))));
}

async function insertRows(db: Queryable, target: Catalog, copy: TableCopy): Promise<void> {
  if (copy.rows.length === 0) return;
  const table = getTable(target, copy.table.key, "target");
  const values = copy.columns.map((column, index) => sql`(r->>${sql.raw(String(index))})::${sql.raw(column.type)}`);
  const writesIdentity = copy.columns.some((column) => table.columns.find((candidate) => candidate.name === column.name)?.isIdentity === true);
  const overriding = writesIdentity ? sql` OVERRIDING SYSTEM VALUE` : sql``;
  try {
    await db.execute(sql`
      INSERT INTO ${tableName(table)} (${columnList(copy.columns.map((column) => column.name))})${overriding}
      SELECT ${sql.join(values, sql`, `)} FROM json_array_elements(${JSON.stringify(copy.rows)}::json) WITH ORDINALITY AS x(r, i) ORDER BY i
    `);
  } catch (error) {
    const driverError = findDriverError(error);
    if (driverError?.code.startsWith(INTEGRITY_VIOLATION_CLASS) !== true) throw error;
    throw new CopyRefusal("privacy.copy_conflict", `the target rejected a row of ${copy.table.key}: ${driverError.constraint ?? driverError.message}`);
  }
}

/** Reads the copy back from the target and checks every written row is there, value for value. */
async function verifyRows(db: Queryable, target: Catalog, copy: TableCopy): Promise<void> {
  if (copy.rows.length === 0) return;
  // The source's predicate names tables and columns the target was checked to have.
  const written = await selectRows(db, getTable(target, copy.table.key, "target"), copy.columns, copy.predicate);
  const counts = new Map<string, number>();
  for (const row of written) counts.set(JSON.stringify(row), (counts.get(JSON.stringify(row)) ?? 0) + 1);
  for (const row of copy.rows) {
    const key = JSON.stringify(row);
    const count = counts.get(key) ?? 0;
    if (count === 0) throw new CopyRefusal("privacy.copy_verification_failed", `a row of ${copy.table.key} reads back differently from the target`);
    counts.set(key, count - 1);
  }
}

/** Moves the sequence of every written identity or serial column past the largest copied value. */
async function advanceSequences(db: Queryable, target: Catalog, copy: TableCopy): Promise<void> {
  if (copy.rows.length === 0) return;
  const table = getTable(target, copy.table.key, "target");
  for (const column of copy.columns) {
    const targetColumn = table.columns.find((candidate) => candidate.name === column.name);
    if (targetColumn === undefined || !(targetColumn.isIdentity || targetColumn.isSerial)) continue;
    const qualified = `${quote(table.schema)}.${quote(table.name)}`;
    await db.execute(sql`
      SELECT setval(seq, m)
      FROM (SELECT pg_get_serial_sequence(${qualified}, ${column.name}) AS seq) AS s,
        LATERAL (SELECT max(${identifier(column.name)})::bigint AS m FROM ${tableName(table)}) AS t
      WHERE seq IS NOT NULL AND m IS NOT NULL
        AND m >= coalesce(pg_sequence_last_value(seq::regclass), 0)
    `);
  }
}

function getTable(catalog: Catalog, key: string, side: "source" | "target" = "source"): Table {
  const table = catalog.tables.get(key);
  if (table === undefined) throw new CopyRefusal("privacy.copy_schema_mismatch", `${key} is not a table in the ${side}`);
  return table;
}

/** The account's email as copied, to find an account the target already has under it. */
function findCopiedEmail(copies: readonly TableCopy[]): string | null {
  const accounts = copies.find((copy) => copy.table.key === ACCOUNTS_KEY);
  const position = accounts?.columns.findIndex((column) => column.name === "email") ?? -1;
  return accounts?.rows[0]?.[position] ?? null;
}

function selectText(columns: readonly Column[]): SQL {
  return sql.join(
    columns.map((column, index) => sql`${identifier(column.name)}::text AS ${identifier(`c${String(index)}`)}`),
    sql`, `,
  );
}

function quote(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function identifier(name: string): SQL {
  return sql.raw(quote(name));
}

function tableName(table: Table): SQL {
  return sql.raw(`${quote(table.schema)}.${quote(table.name)}`);
}

function columnList(names: readonly string[]): SQL {
  return sql.raw(names.map(quote).join(", "));
}
