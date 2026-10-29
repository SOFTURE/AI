// What every server function receives, and the mapping from a row to the file the app sees.
import type { ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import type { StoredFile } from "../contract.js";
import type { FileRow } from "../schema.js";

export type Env = Readonly<Record<string, string | undefined>>;

/** The module context; `env` defaults to `process.env` (the link keyring). */
export interface FilesContext extends ModuleContext<Queryable> {
  readonly env?: Env;
}

export function toStoredFile(row: FileRow): StoredFile {
  return {
    id: row.id,
    ownerId: row.ownerId,
    sha256: row.sha256,
    size: row.size,
    contentType: row.contentType,
    name: row.originalName,
    kind: row.kind,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

/** The storage key of a file: two levels of fan-out by its id, so no folder holds more than 256 entries per level. */
export function getStorageKey(fileId: string): string {
  const hex = fileId.replaceAll("-", "");
  return `${hex.slice(0, 2)}/${hex.slice(2, 4)}/${fileId}`;
}
