// What the device keeps for a signed-in user, and clearing it on sign-out. The app and its modules register their
// parts (named caches, IndexedDB databases or stores, `localStorage` keys); `clearDeviceData()` clears every part,
// whatever the others do, and asks the controlling worker to drop the pages it kept. Browser globals are read only
// when it runs, so this file is safe to import on the server.

/** An IndexedDB database to delete, or one store of it to empty. */
export interface IndexedDbPart {
  readonly database: string;
  /** Only this store is emptied; without it the whole database is deleted. */
  readonly store?: string;
}

export interface DeviceDataParts {
  /** Cache Storage names, deleted whole. */
  readonly caches?: readonly string[];
  readonly indexedDb?: readonly IndexedDbPart[];
  /** `localStorage` keys. */
  readonly storageKeys?: readonly string[];
}

/** The part names that could not be cleared, e.g. `cache:fire-maps`, `indexedDb:fire/snapshots`, `storage:draft`. */
export interface DeviceDataClearing {
  readonly failed: readonly string[];
}

/** The browser APIs the clearing uses; each defaults to the global and is skipped when missing. */
export interface DeviceDataDependencies {
  readonly caches?: Pick<CacheStorage, "delete"> | null;
  readonly indexedDB?: Pick<IDBFactory, "open" | "deleteDatabase"> | null;
  readonly storage?: Pick<Storage, "removeItem"> | null;
  readonly serviceWorker?: { readonly controller: Pick<ServiceWorker, "postMessage"> | null } | null;
}

interface ClearablePart {
  readonly name: string;
  clear(): Promise<void>;
}

const registrations = new Set<DeviceDataParts>();

function checkNames(kind: string, names: readonly string[]): void {
  for (const name of names) {
    if (name.trim() === "") throw new Error(`registerDeviceData: a ${kind} name must not be empty`);
  }
}

/**
 * Registers what the device keeps for the signed-in user, for `clearDeviceData()`. Call it once per owner (the app, a
 * module); the parts of every registration are cleared together, each once. Returns the function that unregisters.
 */
export function registerDeviceData(parts: DeviceDataParts): () => void {
  checkNames("cache", parts.caches ?? []);
  checkNames("storage key", parts.storageKeys ?? []);
  checkNames("database", (parts.indexedDb ?? []).map((part) => part.database));
  checkNames("store", (parts.indexedDb ?? []).flatMap((part) => (part.store === undefined ? [] : [part.store])));
  const registration = { ...parts };
  registrations.add(registration);
  return () => {
    registrations.delete(registration);
  };
}

/** The global, or `null` when it is missing or reading it throws (e.g. `localStorage` in a blocked context). */
function readGlobal<T>(read: () => T | undefined): T | null {
  try {
    return read() ?? null;
  } catch {
    return null;
  }
}

function resolveDependencies(dependencies: DeviceDataDependencies): Required<DeviceDataDependencies> {
  return {
    caches: dependencies.caches !== undefined ? dependencies.caches : readGlobal(() => globalThis.caches),
    indexedDB: dependencies.indexedDB !== undefined ? dependencies.indexedDB : readGlobal(() => globalThis.indexedDB),
    storage: dependencies.storage !== undefined ? dependencies.storage : readGlobal(() => globalThis.localStorage),
    serviceWorker:
      dependencies.serviceWorker !== undefined ? dependencies.serviceWorker : readGlobal(() => globalThis.navigator?.serviceWorker),
  };
}

function deleteDatabase(factory: Pick<IDBFactory, "deleteDatabase">, database: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(database);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`deleting IndexedDB database ${database} failed`));
    // Another connection holds the database: the deletion waits for it, a sign-out does not.
    request.onblocked = () => reject(new Error(`deleting IndexedDB database ${database} is blocked by an open connection`));
  });
}

function emptyStore(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`emptying IndexedDB store ${store} failed`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`emptying IndexedDB store ${store} was aborted`));
  });
}

/** Opens an existing database, or resolves `null` when there is none (the upgrade that would create it is aborted). */
function openExisting(factory: Pick<IDBFactory, "open">, database: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const request = factory.open(database);
    let isMissing = false;
    request.onupgradeneeded = () => {
      isMissing = true;
      request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      if (isMissing) resolve(null);
      else reject(request.error ?? new Error(`opening IndexedDB database ${database} failed`));
    };
  });
}

async function clearStore(factory: Pick<IDBFactory, "open">, database: string, store: string): Promise<void> {
  const db = await openExisting(factory, database);
  if (db === null) return;
  try {
    if (db.objectStoreNames.contains(store)) await emptyStore(db, store);
  } finally {
    db.close();
  }
}

function collectParts(dependencies: Required<DeviceDataDependencies>): ClearablePart[] {
  const parts = new Map<string, () => Promise<void>>();
  const { caches, indexedDB, storage, serviceWorker } = dependencies;
  for (const registration of registrations) {
    if (caches !== null) {
      for (const name of registration.caches ?? []) {
        parts.set(`cache:${name}`, async () => {
          await caches.delete(name);
        });
      }
    }
    if (indexedDB !== null) {
      for (const { database, store } of registration.indexedDb ?? []) {
        if (store === undefined) parts.set(`indexedDb:${database}`, () => deleteDatabase(indexedDB, database));
        else parts.set(`indexedDb:${database}/${store}`, () => clearStore(indexedDB, database, store));
      }
    }
    if (storage !== null) {
      for (const key of registration.storageKeys ?? []) {
        parts.set(`storage:${key}`, () => {
          storage.removeItem(key);
          return Promise.resolve();
        });
      }
    }
  }
  const controller = serviceWorker?.controller ?? null;
  if (controller !== null) {
    parts.set("worker:clear-pages", () => {
      controller.postMessage({ type: "clear-pages" });
      return Promise.resolve();
    });
  }
  return [...parts].map(([name, clear]) => ({ name, clear }));
}

/**
 * Clears every registered part and the pages the controlling worker kept. Every part is tried even when another
 * fails (a part that throws at once is a failed part too); a missing API is skipped. Never rejects: the caller logs
 * `failed` and signs out anyway.
 */
export async function clearDeviceData(dependencies: DeviceDataDependencies = {}): Promise<DeviceDataClearing> {
  const parts = collectParts(resolveDependencies(dependencies));
  const results = await Promise.allSettled(parts.map(async (part) => part.clear()));
  return { failed: parts.filter((_, index) => results[index]?.status === "rejected").map((part) => part.name) };
}
