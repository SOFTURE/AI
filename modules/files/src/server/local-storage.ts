// The local disk driver: one folder (a Docker volume on a one-VPS app), objects at `<dir>/<key>`. A write goes to
// a partial file next to its target and is renamed into place once complete, so a reader never sees half a file and
// a failed write leaves nothing. Creating the driver touches nothing; the folder is made on the first write.
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ByteRange } from "../contract.js";
import type { FileBody, FileStorage, StorageCheck } from "../storage.js";

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;
const PROBE_DIR = ".health";
const PARTIAL_SUFFIX = ".partial";

export interface LocalStorageOptions {
  /** The folder the files live in, absolute or relative to the working directory (e.g. `/data/files`). */
  readonly dir: string;
}

export function createLocalStorage(options: LocalStorageOptions): FileStorage {
  const root = resolve(options.dir);

  function getPath(key: string): string {
    // Keys come from file ids; anything else is a bug, and must never reach the disk as a path.
    if (!KEY_PATTERN.test(key)) throw new RangeError("@softure-ai/files: a storage key must be lowercase letters, digits, - and /");
    return join(root, key);
  }

  return {
    kind: "local",
    async put(body: FileBody, key: string) {
      const target = getPath(key);
      const partial = `${target}.${randomUUID()}${PARTIAL_SUFFIX}`;
      await mkdir(dirname(target), { recursive: true });
      try {
        await pipeline(Readable.from(body), createWriteStream(partial, { flags: "wx" }));
        await rename(partial, target);
      } catch (error) {
        await rm(partial, { force: true });
        throw error;
      }
    },
    async get(key: string, range?: ByteRange) {
      const path = getPath(key);
      if ((await statOrNull(path)) === null) return null;
      const stream = createReadStream(path, range === undefined ? {} : { start: range.start, end: range.end });
      // Node's web stream type is structurally the DOM one; the cast bridges the two declarations.
      return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
    },
    async head(key: string) {
      const stats = await statOrNull(getPath(key));
      return stats === null ? null : { size: stats.size };
    },
    async delete(key: string) {
      await rm(getPath(key), { force: true });
    },
    async check(): Promise<StorageCheck> {
      const probe = join(root, PROBE_DIR, `${randomUUID()}.probe`);
      let isWritable = true;
      try {
        await mkdir(dirname(probe), { recursive: true });
        await writeFile(probe, "ok");
        await rm(probe, { force: true });
      } catch {
        isWritable = false;
      }
      try {
        const stats = await statfs(root);
        return { isWritable, freeBytes: stats.bavail * stats.bsize };
      } catch {
        return { isWritable, freeBytes: null };
      }
    },
  };
}

async function statOrNull(path: string) {
  try {
    const stats = await stat(path);
    return stats.isFile() ? stats : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
