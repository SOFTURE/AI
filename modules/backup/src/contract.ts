// Result types and codes of the backup module. No user-facing copy here: an app's settings screen translates the
// result and error codes through `messages` (docs/02-module-standard.md §6).

/** How a run ended: uploaded, failed, or skipped because the host has no off-site configuration. */
export const BACKUP_RESULTS = ["ok", "failed", "not_configured"] as const;
export type BackupResult = (typeof BACKUP_RESULTS)[number];

/** Safe error codes of a failed run; the message beside them never holds a secret. */
export const BACKUP_ERROR_CODES = [
  "config_invalid",
  "file_missing",
  "encrypt_failed",
  "upload_denied",
  "upload_failed",
  "network_error",
] as const;
export type BackupErrorCode = (typeof BACKUP_ERROR_CODES)[number];

/** What a backup file holds: the database dump or an archive of the data volume's folders. */
export type BackupKind = "database" | "data";

/** One encrypted object a run uploaded. */
export interface BackupObject {
  readonly kind: BackupKind;
  /** The object key in the bucket, `<prefix>/<file name>.age`. */
  readonly key: string;
  /** Bytes of the encrypted object. */
  readonly bytes: number;
  /** sha256 of the encrypted object, hex. */
  readonly sha256: string;
}

/** One recorded run of the off-site copy. */
export interface BackupRun {
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly result: BackupResult;
  readonly objects: readonly BackupObject[];
  readonly sizeBytes: number;
  readonly error: { readonly code: string; readonly message: string } | null;
}

/** What a settings screen shows: the newest run, the newest successful one, or nothing recorded yet. */
export type BackupStatus =
  | { readonly result: "not_configured"; readonly lastRun: null; readonly lastSuccess: null }
  | { readonly result: BackupResult; readonly lastRun: BackupRun; readonly lastSuccess: BackupRun | null };
