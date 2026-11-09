// The host and operator side of @softure-ai/backup: configuration, the nightly upload, status SQL, restore, fetch and
// verify. The `softure-backup` command line wraps these; an app's own code needs only `@softure-ai/backup/server`.
export {
  collectSecrets,
  DEFAULT_REGION,
  READ_ENV_NAMES,
  readReadConfig,
  readUploadConfig,
  redactSecrets,
  SECRET_ENV_NAMES,
  UPLOAD_ENV_NAMES,
  type ConfigResult,
  type StoreConfig,
  type UploadConfig,
} from "./config.js";
export { decryptStream, encryptFile, parseIdentities, type IdentitiesResult } from "./crypto.js";
export {
  buildLifecycleJson,
  buildLifecycleXml,
  DEFAULT_LIFECYCLE_DAYS,
  MAX_LIFECYCLE_DAYS,
  MIN_LIFECYCLE_DAYS,
  parseLifecycleDays,
} from "./lifecycle.js";
export { buildObjectKey, OBJECT_SUFFIX, parseBackupFileName, parseObjectKey, selectNewestKey, type BackupFileName } from "./objects.js";
export { fetchBackup, resolveKey, restoreBackup, type FetchOptions, type OffsiteResult, type RestoreOptions, type RestoreOutcome } from "./restore.js";
export { getObjectStream, getObjectUrl, listObjects, putObjectFile, S3RequestError, type S3Options, type StoredObject } from "./s3.js";
export { EMPTY_SHA256, encodeRfc3986, formatAmzDate, signRequest, type SignInput } from "./sigv4.js";
export { buildStatusSql, getPruneBefore, quoteLiteral, STATUS_RETENTION_DAYS } from "./status-sql.js";
export { buildNotConfiguredRecord, hashFile, uploadBackups, type RunRecord, type UploadOptions } from "./upload.js";
export { DEFAULT_MAX_AGE_HOURS, selectVerifyTables, verifyBackup, type VerifyOptions, type VerifyOutcome } from "./verify.js";
