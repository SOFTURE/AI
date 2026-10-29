// The storage driver contract: where the bytes of a file live. The module keeps the rows; a driver keeps only the
// blobs, under keys the module makes from the file id (`ab/cd/<uuid>`), never from user input.
import type { ByteRange } from "./contract.js";

/** A file's bytes as a driver receives them: a Node stream, a web stream or any async iterable of chunks. */
export type FileBody = AsyncIterable<Uint8Array>;

/** What a driver's health probe found. */
export interface StorageCheck {
  /** A probe object could be written and deleted. */
  readonly isWritable: boolean;
  /** The free bytes where the files live, or null when the driver cannot tell (object storage). */
  readonly freeBytes: number | null;
}

export interface FileStorage {
  /** A short name for logs and the README (`local`, `s3`, `memory`). */
  readonly kind: string;
  /**
   * Stores `body` under `key`, replacing nothing visible until the whole body is written: a body that throws half
   * way leaves no object behind and the error propagates.
   */
  put(body: FileBody, key: string): Promise<void>;
  /** The object's bytes, or the inclusive `range` of them; null when there is no such object. */
  get(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array> | null>;
  /** The object's size, or null when there is no such object. */
  head(key: string): Promise<{ readonly size: number } | null>;
  /** Deletes the object; deleting a missing one is not an error. */
  delete(key: string): Promise<void>;
  /** Probes the storage for the health check; a driver without one counts as healthy. */
  check?(): Promise<StorageCheck>;
}

/** Whether a value has the driver methods (the options schema's check). */
export function isFileStorage(value: unknown): value is FileStorage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.kind === "string" &&
    ["put", "get", "head", "delete"].every((name) => typeof candidate[name] === "function") &&
    (candidate.check === undefined || typeof candidate.check === "function")
  );
}
