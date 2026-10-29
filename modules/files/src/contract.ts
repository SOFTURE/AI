// Result types and error codes of the files module. No user-facing copy here: an app translates codes through
// `messages` (docs/02-module-standard.md §6).

/** The link keyring cannot sign: a configuration problem, never fixed by retrying. */
export type FilesKeyErrorCode =
  /** `SOFTURE_FILES_LINK_KEYS` is not set. */
  | "files.link_key_missing"
  /** `SOFTURE_FILES_LINK_KEYS` is set but is not a list of `<id>:<base64 32 bytes>`. */
  | "files.link_key_invalid";

/** Why `saveFile` refused a file. */
export type FilesSaveErrorCode =
  /** The input breaks a rule: an empty owner, a malformed kind or content type, an expiry in the past. */
  | "files.invalid_input"
  /** The file is larger than `maxFileBytes`. */
  | "files.too_large"
  /** Saving it would take the owner above `quotaBytesPerOwner`. */
  | "files.quota_exceeded";

/** Why a file could not be read, deleted or linked. */
export type FilesLookupErrorCode =
  /** No live file has this id (unknown, another owner's, deleted or expired). */
  | "files.not_found"
  /** The asked range starts at or after the end of the file. */
  | "files.range_not_satisfiable";

export type FilesErrorCode = FilesKeyErrorCode | FilesSaveErrorCode | FilesLookupErrorCode;

/** A stored file as the app sees it. Never carries the storage key. */
export interface StoredFile {
  readonly id: string;
  /** The account the file belongs to (an auth user id, or any id the app keeps). */
  readonly ownerId: string;
  /** Lowercase hex SHA-256 of the content. */
  readonly sha256: string;
  readonly size: number;
  readonly contentType: string;
  /** The name it was saved under, sanitised: no folders, no control characters, at most 255 characters. */
  readonly name: string;
  /** The app's own category (`input`, `output`, `export`). */
  readonly kind: string;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

/** An inclusive byte range, both ends within the file. */
export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/** A public link to a file. */
export interface FileLink {
  /** The absolute URL on the app's origin. */
  readonly url: string;
  /** The path part, `/f/<id>/<expiry>/<signature>/<name>`. */
  readonly path: string;
  readonly expiresAt: Date;
}
