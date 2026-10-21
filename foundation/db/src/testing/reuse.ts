// Reusable test databases (`createTestDatabase(modules, { reuse: true })`, issue #641). Booting a PGlite from the
// template costs ~0.6 s; putting a used one back costs a few milliseconds. A database closed by a test goes back to a
// pool per template; the next call takes it and restores the template's state: every table emptied and its template
// rows copied back (migration ledgers and seed rows included), sequences set to the template's values, materialized
// views refreshed, session state discarded. A database whose schema the test changed (a table, column, function,
// trigger, constraint or enum value) is closed and replaced by a fresh copy, since rows are all a reset can undo.
// The pool is module state: one test file under Vitest's default isolation; `closeReusedTestDatabases` empties it.
import type { PGlite } from "@electric-sql/pglite";
import type { PgliteClientDatabase } from "../client.js";

export interface PooledDatabase {
  readonly db: PgliteClientDatabase;
  readonly client: PGlite;
  readonly close: () => Promise<void>;
}

interface SeedTable {
  readonly table: string;
  readonly columns: string;
  readonly rows: Blob;
}

interface SequenceValue {
  readonly name: string;
  readonly value: string;
  readonly called: boolean;
}

interface TemplateState {
  readonly fingerprint: string;
  readonly tables: readonly string[];
  readonly seeds: readonly SeedTable[];
  readonly sequences: readonly SequenceValue[];
  readonly materializedViews: readonly string[];
}

interface Pool {
  readonly idle: PooledDatabase[];
  state: Promise<TemplateState> | undefined;
  isRetired: boolean;
}

const pools = new Map<string, Pool>();

const USER_NAMESPACE = "n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\\_toast%' and n.nspname not like 'pg\\_temp\\_%'";

// What a reset cannot undo. Indexes, constraints and triggers are listed with their table, enum labels with their type.
const FINGERPRINT_SQL = `
select coalesce(string_agg(entry, E'\\n' order by entry), '') as fingerprint from (
  select format('rel %s %I.%I %s', c.relkind, n.nspname, c.relname,
    (select string_agg(format('%I:%s', a.attname, format_type(a.atttypid, a.atttypmod)), ',' order by a.attnum)
      from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)) as entry
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where ${USER_NAMESPACE}
  union all
  select format('fn %I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where ${USER_NAMESPACE}
  union all
  select format('con %s %s %s', co.conrelid::regclass, co.conname, co.contype)
    from pg_constraint co join pg_namespace n on n.oid = co.connamespace where ${USER_NAMESPACE}
  union all
  select format('trg %s %s %s', t.tgrelid::regclass, t.tgname, t.tgenabled) from pg_trigger t where not t.tgisinternal
  union all
  select format('enum %s %s', e.enumtypid::regtype, e.enumlabel)
    from pg_enum e join pg_type ty on ty.oid = e.enumtypid join pg_namespace n on n.oid = ty.typnamespace where ${USER_NAMESPACE}
) entries`;

const TABLES_SQL = `
select format('%I.%I', n.nspname, c.relname) as name, c.relkind::text as kind, c.relispopulated as populated,
  (select string_agg(format('%I', a.attname), ', ' order by a.attnum) from pg_attribute a
    where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and a.attgenerated = '') as columns
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'm') and ${USER_NAMESPACE}
order by 1`;

const SEQUENCES_SQL = `
select format('%I.%I', schemaname, sequencename) as name, coalesce(last_value, start_value)::text as value, last_value is not null as called
from pg_sequences where schemaname not in ('pg_catalog', 'information_schema')`;

const RESTORE_SEQUENCES_SQL = "select setval(s.name::regclass, s.value, s.called) from json_to_recordset($1::json) as s(name text, value bigint, called boolean)";

/**
 * A database from the pool of `key`, reset to the template's state, or a fresh copy from `open` when none is idle.
 * Its `close` puts it back; a second `close` does nothing.
 */
export async function acquirePooledDatabase(key: string, open: () => Promise<PooledDatabase>): Promise<PooledDatabase> {
  const pool = getPool(key);
  for (let idle = pool.idle.pop(); idle !== undefined; idle = pool.idle.pop()) {
    if (pool.state !== undefined && (await tryRestore(idle.client, await pool.state))) {
      return lend(pool, idle);
    }
    await idle.close();
  }
  const fresh = await open();
  try {
    pool.state ??= captureTemplateState(fresh.client);
    await pool.state;
  } catch (error) {
    pool.state = undefined;
    await fresh.close();
    throw error;
  }
  return lend(pool, fresh);
}

/** Closes every idle database of every pool; for `afterAll`. A database still held is closed when it comes back. */
export async function closePooledDatabases(): Promise<void> {
  const retired = [...pools.values()];
  pools.clear();
  for (const pool of retired) pool.isRetired = true;
  const idle = retired.flatMap((pool) => pool.idle.splice(0));
  await Promise.all(idle.map((database) => database.close()));
}

function getPool(key: string): Pool {
  let pool = pools.get(key);
  if (pool === undefined) {
    pool = { idle: [], state: undefined, isRetired: false };
    pools.set(key, pool);
  }
  return pool;
}

function lend(pool: Pool, database: PooledDatabase): PooledDatabase {
  let isReturned = false;
  return {
    db: database.db,
    client: database.client,
    close: () => {
      if (isReturned) {
        return Promise.resolve();
      }
      isReturned = true;
      if (pool.isRetired) {
        return database.close();
      }
      pool.idle.push(database);
      return Promise.resolve();
    },
  };
}

async function captureTemplateState(client: PGlite): Promise<TemplateState> {
  const fingerprint = await readFingerprint(client);
  const relations = await client.query<{ name: string; kind: string; populated: boolean; columns: string | null }>(TABLES_SQL);
  const seeds: SeedTable[] = [];
  for (const relation of relations.rows) {
    if (relation.kind !== "r" || relation.columns === null) {
      continue;
    }
    const hasRows = await client.query<{ has_rows: boolean }>(`select exists (select 1 from ${relation.name}) as has_rows`);
    if (hasRows.rows[0]?.has_rows === true) {
      const copied = await client.query(`copy ${relation.name} (${relation.columns}) to '/dev/blob'`);
      if (copied.blob === undefined) {
        throw new Error(`createTestDatabase: copying the template rows of ${relation.name} returned no data`);
      }
      seeds.push({ table: relation.name, columns: relation.columns, rows: copied.blob });
    }
  }
  const sequences = await client.query<SequenceValue>(SEQUENCES_SQL);
  return {
    fingerprint,
    tables: relations.rows.filter((relation) => relation.kind !== "m").map((relation) => relation.name),
    seeds,
    sequences: sequences.rows,
    materializedViews: relations.rows.filter((relation) => relation.kind === "m" && relation.populated).map((relation) => relation.name),
  };
}

async function readFingerprint(client: PGlite): Promise<string> {
  const result = await client.query<{ fingerprint: string }>(FINGERPRINT_SQL);
  return result.rows[0]?.fingerprint ?? "";
}

/**
 * Restores the template's rows and session state. `false` when the database cannot be reset (its schema changed, or
 * the test left it in a state a reset fails on, such as an open transaction): the caller replaces it.
 */
async function tryRestore(client: PGlite, state: TemplateState): Promise<boolean> {
  try {
    await client.exec("DISCARD ALL");
    if ((await readFingerprint(client)) !== state.fingerprint) {
      return false;
    }
    await client.transaction(async (tx) => {
      // Rows go back as they were, so foreign keys and triggers stay out of the way.
      await tx.exec("SET LOCAL session_replication_role = replica");
      if (state.tables.length > 0) {
        await tx.exec(`TRUNCATE ${state.tables.join(", ")} CASCADE`);
      }
      for (const seed of state.seeds) {
        await tx.query(`copy ${seed.table} (${seed.columns}) from '/dev/blob'`, [], { blob: seed.rows });
      }
      if (state.sequences.length > 0) {
        await tx.query(RESTORE_SEQUENCES_SQL, [JSON.stringify(state.sequences)]);
      }
      for (const view of state.materializedViews) {
        await tx.exec(`REFRESH MATERIALIZED VIEW ${view}`);
      }
    });
    return true;
  } catch {
    // Deliberately not reported: a database a test broke is replaced by a fresh copy, which is what the test expects.
    return false;
  }
}
