// Account ids are auth's uuids, and the module's own rows use uuids too; anything else names no row
// and is answered without a query (Postgres would refuse to compare it with a uuid column).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` can be a row id (a uuid). */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function isUserId(value: string): boolean {
  return isUuid(value);
}
