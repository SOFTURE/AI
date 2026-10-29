// An in-memory storage driver for tests: the same contract as the disk and S3 drivers, plus a look at what it holds
// and a switch to make the next writes fail.
import type { ByteRange } from "../contract.js";
import type { FileBody, FileStorage, StorageCheck } from "../storage.js";

export interface MemoryStorage extends FileStorage {
  /** The stored objects by key (a copy). */
  readonly objects: () => ReadonlyMap<string, Uint8Array>;
  /** What `check()` answers; healthy with plenty of space by default. */
  setCheck(check: StorageCheck): void;
  /** Makes `put` (after reading the whole body) and `delete` throw until called with false. */
  setFailing(isFailing: boolean): void;
}

export function createMemoryStorage(): MemoryStorage {
  const objects = new Map<string, Uint8Array>();
  let health: StorageCheck = {
    isWritable: true,
    freeBytes: Number.MAX_SAFE_INTEGER,
  };
  let isFailing = false;

  return {
    kind: "memory",
    objects: () => new Map(objects),
    setCheck(check) {
      health = check;
    },
    setFailing(value) {
      isFailing = value;
    },
    async put(body: FileBody, key: string) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of body) chunks.push(chunk);
      if (isFailing) throw new Error("memory storage: put failed (setFailing)");
      objects.set(key, Buffer.concat(chunks));
    },
    get(key: string, range?: ByteRange) {
      const bytes = objects.get(key);
      if (bytes === undefined) return Promise.resolve(null);
      const slice = range === undefined ? bytes : bytes.subarray(range.start, range.end + 1);
      return Promise.resolve(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(slice));
            controller.close();
          },
        }),
      );
    },
    head(key: string) {
      const bytes = objects.get(key);
      return Promise.resolve(bytes === undefined ? null : { size: bytes.byteLength });
    },
    delete(key: string) {
      if (isFailing) return Promise.reject(new Error("memory storage: delete failed (setFailing)"));
      objects.delete(key);
      return Promise.resolve();
    },
    check() {
      return Promise.resolve(health);
    },
  };
}
