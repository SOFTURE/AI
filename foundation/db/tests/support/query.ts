// Raw reads for assertions, on either driver.
import type { DatabaseHandle } from "@softure-ai/db";

export async function queryRows<T>(handle: DatabaseHandle, text: string, params: unknown[] = []): Promise<T[]> {
  if (handle.kind === "pglite") {
    return (await handle.client.query<T>(text, params)).rows;
  }
  return (await handle.pool.query(text, params)).rows as T[];
}

export async function execSql(handle: DatabaseHandle, text: string): Promise<void> {
  if (handle.kind === "pglite") {
    await handle.client.exec(text);
  } else {
    await handle.pool.query(text);
  }
}

export interface LedgerRow {
  module: string;
  version: number;
  name: string;
  method: string;
}

export function readLedger(handle: DatabaseHandle): Promise<LedgerRow[]> {
  return queryRows<LedgerRow>(handle, "SELECT module, version, name, method FROM softure.migrations ORDER BY id");
}

export async function hasRelation(handle: DatabaseHandle, name: string): Promise<boolean> {
  const [row] = await queryRows<{ exists: boolean }>(handle, "SELECT to_regclass($1) IS NOT NULL AS exists", [name]);
  return row?.exists === true;
}

export async function hasSchema(handle: DatabaseHandle, name: string): Promise<boolean> {
  const rows = await queryRows(handle, "SELECT 1 FROM pg_namespace WHERE nspname = $1", [name]);
  return rows.length === 1;
}
