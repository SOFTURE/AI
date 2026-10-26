// PGlite has one connection: a query on the instance (the pool) made while one of its transactions waits for that
// query waits for the transaction to end, which never happens, so the test hangs until its timeout (#785). Every
// transaction callback runs in a scope bound to its client; an instance call from inside an open scope rejects at
// once. Unrelated concurrent work carries no scope and still waits for the transaction, as PGlite serializes it.
import { AsyncLocalStorage } from "node:async_hooks";
import type { PGlite } from "@electric-sql/pglite";

interface TransactionScope {
  readonly client: PGlite;
  isOpen: boolean;
}

const scopes = new AsyncLocalStorage<TransactionScope>();
const guarded = new WeakSet<PGlite>();

/** A query on the test database's pool from inside one of its transactions, which would wait forever on PGlite. */
export class PoolInsideTransactionError extends Error {
  constructor(method: string) {
    super(
      `createTestDatabase: ${method}() on the database was called inside an open transaction of the same database. ` +
        "PGlite has one connection, so the call would wait for that transaction forever. Run it through the " +
        "transaction's db instead (e.g. the db a processSyncItem callback gets, or { ...ctx, db: tx } for a helper " +
        "that takes a context).",
    );
    this.name = "PoolInsideTransactionError";
  }
}

/** Makes `client` reject a `query`, `exec` or `transaction` call made from inside one of its open transactions. */
export function guardPoolInsideTransaction(client: PGlite): void {
  if (guarded.has(client)) {
    return;
  }
  guarded.add(client);
  const query = client.query.bind(client);
  const exec = client.exec.bind(client);
  const transaction = client.transaction.bind(client);
  const rejectInsideTransaction = (method: string): Promise<never> | null => {
    const scope = scopes.getStore();
    return scope?.client === client && scope.isOpen ? Promise.reject(new PoolInsideTransactionError(method)) : null;
  };
  client.query = ((...args: Parameters<PGlite["query"]>) => rejectInsideTransaction("query") ?? query(...args)) as PGlite["query"];
  client.exec = ((...args: Parameters<PGlite["exec"]>) => rejectInsideTransaction("exec") ?? exec(...args));
  client.transaction = ((callback: Parameters<PGlite["transaction"]>[0]) =>
    rejectInsideTransaction("transaction") ??
    transaction(async (tx) => {
      const scope: TransactionScope = { client, isOpen: true };
      try {
        return await scopes.run(scope, () => callback(tx));
      } finally {
        scope.isOpen = false;
      }
    })) as PGlite["transaction"];
}
