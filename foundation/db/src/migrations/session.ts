// One raw connection for a migration run. The advisory lock is session-level, so the lock, every
// transaction and every statement of a run must share this connection (never `pool.query`).
import type { DatabaseHandle } from "../client.js";

type PgliteClient = Extract<DatabaseHandle, { kind: "pglite" }>["client"];

export interface MigrationSession {
  /** A parameterised statement; returns its rows. */
  readonly query: <T>(text: string, params?: readonly unknown[]) => Promise<T[]>;
  /** One or more statements without parameters (a migration file). */
  readonly exec: (sql: string) => Promise<void>;
}

interface SessionSetting {
  readonly name: string;
  readonly value: string;
}

const SESSION_SETTINGS_SQL = "SELECT name, current_setting(name) AS value FROM pg_settings WHERE source = 'session'";

/**
 * Runs `run` on one dedicated connection. A pg client is destroyed afterwards instead of going
 * back to the pool, so a `SET` inside a migration file or a lock that failed to release cannot
 * leak into the app's queries. PGlite has one connection, shared with the app, so the settings the
 * run changed are put back afterwards; the app's own (`TimeZone`, `search_path`) stay as they were.
 */
export async function withSession<T>(handle: DatabaseHandle, run: (session: MigrationSession) => Promise<T>): Promise<T> {
  if (handle.kind === "pglite") {
    const { client } = handle;
    const before = (await client.query<SessionSetting>(SESSION_SETTINGS_SQL)).rows;
    try {
      return await run({
        query: async <R>(text: string, params?: readonly unknown[]) => (await client.query<R>(text, params ? [...params] : undefined)).rows,
        exec: async (sql) => {
          await client.exec(sql);
        },
      });
    } finally {
      await restoreSessionSettings(client, before);
    }
  }

  const client = await handle.pool.connect();
  // A dropped connection makes pg emit 'error' on the client; without a listener Node crashes the
  // process. The pending query rejects on its own, so the listener only has to exist.
  const ignoreClientError = (): void => undefined;
  client.on("error", ignoreClientError);
  try {
    return await run({
      query: async <R>(text: string, params?: readonly unknown[]) => (await client.query(text, params ? [...params] : undefined)).rows as R[],
      exec: async (sql) => {
        await client.query(sql);
      },
    });
  } finally {
    client.release(true);
    client.off("error", ignoreClientError);
  }
}

/** Puts back every value in `before` (also one the run reset) and resets every session setting the run added. */
async function restoreSessionSettings(client: PgliteClient, before: readonly SessionSetting[]): Promise<void> {
  const after = new Map((await client.query<SessionSetting>(SESSION_SETTINGS_SQL)).rows.map((setting) => [setting.name, setting.value]));
  for (const setting of before) {
    if (after.get(setting.name) !== setting.value) {
      await client.query("SELECT set_config($1, $2, false)", [setting.name, setting.value]);
    }
    after.delete(setting.name);
  }
  for (const name of after.keys()) {
    // Names come from pg_settings, not from input; quoted as identifiers all the same.
    await client.exec(`RESET "${name.replaceAll('"', '""')}"`);
  }
}
