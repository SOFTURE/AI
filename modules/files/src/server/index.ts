// Server-only API of @softure-ai/files. Every function receives the module context (`{ db, clock, config }`, plus
// an optional `env` for the link keyring) and never reads request scope.
export { getStorageKey, type Env, type FilesContext } from "./context.js";
export {
  clipRange,
  deleteFile,
  findFile,
  getOwnerUsage,
  listFiles,
  openFile,
  type DeleteFileResult,
  type FileLookupOptions,
  type ListFilesInput,
  type OpenedFile,
  type OpenFileOptions,
  type OpenFileResult,
} from "./files.js";
export { checkFilesHealth, type FilesHealthErrorCode } from "./health.js";
export { FILES_LINK_KEYS_ENV, generateFilesLinkKey, readLinkKeyring, type LinkKeyring, type LinkKeyringResult } from "./keys.js";
export {
  createFileLink,
  revokeFileLinks,
  verifyFileLink,
  type CreateFileLinkInput,
  type CreateFileLinkResult,
  type RevokeFileLinksResult,
  type VerifiedLink,
  type VerifyFileLinkResult,
} from "./links.js";
export { createLocalStorage, type LocalStorageOptions } from "./local-storage.js";
export { DEFAULT_CONTENT_TYPE, formatContentDisposition, normalizeContentType, sanitizeFileName } from "./names.js";
export { getFilesModule, getFilesOptions, getLinksRoute } from "./options.js";
export { deleteFilesUserData, exportFilesUserData, filesPrivacyContributor, type FilesDeletionReport, type FilesUserData } from "./privacy.js";
export { pruneFiles, type PruneFilesOptions, type PruneFilesReport } from "./prune.js";
export {
  createS3Storage,
  S3_ACCESS_KEY_ID_ENV,
  S3_SECRET_ACCESS_KEY_ENV,
  S3StorageError,
  splitIntoParts,
  type S3StorageOptions,
} from "./s3-storage.js";
export { saveFile, type SaveFileInput, type SaveFileResult } from "./save.js";
export { parseRangeHeader, serveFileLink } from "./serve.js";
export { EMPTY_PAYLOAD_SHA256, encodeRfc3986, signRequest, type SigV4Credentials, type SignRequestInput } from "./sigv4.js";
