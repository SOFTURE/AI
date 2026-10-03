// Account ids are auth's uuids; anything else names no account and is answered without a query
// (Postgres would refuse to compare it with a uuid column).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUserId(value: string): boolean {
  return UUID.test(value);
}
