// A fake `IDBFactory` with just what `clearDeviceData` uses: `deleteDatabase` (optionally blocked by an open
// connection), `open` with its upgrade step, and read-write transactions that empty a store. Events fire on a later
// tick, as the browser's do.

type Handler = (() => void) | null;

export class FakeRequest<T> {
  result: T | undefined;
  error: DOMException | null = null;
  transaction: { abort(): void } | null = null;
  onsuccess: Handler = null;
  onerror: Handler = null;
  onblocked: Handler = null;
  onupgradeneeded: Handler = null;
}

export class FakeIndexedDb {
  /** Database name → store name → records. */
  readonly databases = new Map<string, Map<string, Map<string, unknown>>>();
  /** Databases with another open connection: deleting them is blocked. */
  readonly blocked = new Set<string>();
  /** Databases whose store clearing fails. */
  readonly failingStores = new Set<string>();
  closed = 0;

  addStore(database: string, store: string, records: Record<string, unknown> = { a: 1 }): void {
    const stores = this.databases.get(database) ?? new Map<string, Map<string, unknown>>();
    stores.set(store, new Map(Object.entries(records)));
    this.databases.set(database, stores);
  }

  deleteDatabase(name: string): IDBOpenDBRequest {
    const request = new FakeRequest<undefined>();
    setTimeout(() => {
      if (this.blocked.has(name)) {
        request.onblocked?.();
        return;
      }
      this.databases.delete(name);
      request.onsuccess?.();
    });
    return request as unknown as IDBOpenDBRequest;
  }

  open(name: string): IDBOpenDBRequest {
    const request = new FakeRequest<IDBDatabase>();
    setTimeout(() => {
      const stores = this.databases.get(name);
      if (stores === undefined) {
        let isAborted = false;
        request.transaction = {
          abort: () => {
            isAborted = true;
          },
        };
        this.databases.set(name, new Map());
        request.onupgradeneeded?.();
        if (isAborted) {
          this.databases.delete(name);
          request.error = new DOMException("The upgrade was aborted", "AbortError");
          request.onerror?.();
          return;
        }
      }
      request.result = this.connect(name);
      request.onsuccess?.();
    });
    return request as unknown as IDBOpenDBRequest;
  }

  private connect(name: string): IDBDatabase {
    const stores = this.databases.get(name) ?? new Map<string, Map<string, unknown>>();
    const db = {
      objectStoreNames: { contains: (store: string) => stores.has(store) },
      close: () => {
        this.closed += 1;
      },
      transaction: (store: string) => {
        const transaction = {
          error: null as DOMException | null,
          oncomplete: null as Handler,
          onerror: null as Handler,
          onabort: null as Handler,
          objectStore: () => ({
            clear: () => {
              setTimeout(() => {
                if (this.failingStores.has(`${name}/${store}`)) {
                  transaction.error = new DOMException("The store is broken", "UnknownError");
                  transaction.onerror?.();
                  return;
                }
                stores.get(store)?.clear();
                transaction.oncomplete?.();
              });
            },
          }),
        };
        return transaction;
      },
    };
    return db as unknown as IDBDatabase;
  }
}
