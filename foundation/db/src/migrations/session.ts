// One raw connection for a migration run. The advisory lock is session-level, so the lock, every
// transaction and every statement of a run must share this connection (never `pool.query`).
import type { DatabaseHandle } from "../client.js";

export interface MigrationSession {
  /** A parameterised statement; returns its rows. */
  readonly query: <T>(text: string, params?: readonly unknown[]) => Promise<T[]>;
  /** One or more statements without parameters (a migration file). */
  readonly exec: (sql: string) => Promise<void>;
}

/**
 * Runs `run` on one dedicated connection. A pg client is destroyed afterwards instead of going
 * back to the pool, so a `SET` inside a migration file or a lock that failed to release cannot
 * leak into the app's queries. PGlite has one connection, so its settings are reset instead.
 */
export async function withSession<T>(handle: DatabaseHandle, run: (session: MigrationSession) => Promise<T>): Promise<T> {
  if (handle.kind === "pglite") {
    const { client } = handle;
    try {
      return await run({
        query: async <R>(text: string, params?: readonly unknown[]) => (await client.query<R>(text, params ? [...params] : undefined)).rows,
        exec: async (sql) => {
          await client.exec(sql);
        },
      });
    } finally {
      await client.exec("RESET ALL");
    }
  }

  const client = await handle.pool.connect();
  try {
    return await run({
      query: async <R>(text: string, params?: readonly unknown[]) => (await client.query(text, params ? [...params] : undefined)).rows as R[],
      exec: async (sql) => {
        await client.query(sql);
      },
    });
  } finally {
    client.release(true);
  }
}
