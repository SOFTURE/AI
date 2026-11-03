// Public API of @softure-ai/files: the module factory for softure.config.ts, its types, messages and table. The
// storage drivers and every database function are in `@softure-ai/files/server`, the link route in `/next`, the
// prune job in `/jobs` and the test helpers (an in-memory driver, link checks) in `/testing`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import type { RateLimitBucketInput } from "@softure-ai/security";
import { filesMessages } from "./messages/index.js";
import { filesOptionsSchema } from "./options.js";
import { checkFilesHealth } from "./server/health.js";
import { filesPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "files";

/**
 * The rate limit bucket of the upload route, to spread into `security({ buckets })` when the app enables the
 * security module: requests per upload session. 64 MiB chunks of a 2 GiB file are 32 requests; the rest is room for
 * resumes and status checks.
 */
export const FILES_RATE_LIMIT_BUCKETS = {
  "files-upload": { limit: 600, windowMinutes: 15, key: "subject" },
} as const satisfies Readonly<Record<string, RateLimitBucketInput>>;

/**
 * Enables stored files in `softure.config.ts`:
 * `files({ storage: createLocalStorage({ dir: "/data/files" }), quotaBytesPerOwner: 2 * 1024 ** 3 })`.
 */
export const files = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.2.0",
    dependsOn: { jobs: "^0.1.6?", security: "^0.2.5?" },
    dbSchema: "files",
    tables: ["files", "uploads"],
    env: [
      {
        name: "SOFTURE_FILES_LINK_KEYS",
        required: false,
        description:
          "Signing keyring for public file links: <id>:<base64 32 bytes>[,<id>:<key>...], the first one signs; needed only by createFileLink and the link route",
      },
    ],
    switches: [],
    routes: { links: "/f", uploads: "/u" },
    mount: [
      {
        kind: "route-handler",
        path: "app/f/[...link]/route.ts",
        export: "serveFileLinkRoute",
      },
      {
        kind: "route-handler",
        path: "app/u/[...upload]/route.ts",
        export: "serveUploadRoute",
      },
    ],
    privacy: { exports: true, deletes: true },
  },
  messages: filesMessages,
  options: filesOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: filesPrivacyContributor,
  health: checkFilesHealth,
});

export type {
  ByteRange,
  CreatedUpload,
  FileLink,
  FilesErrorCode,
  FilesKeyErrorCode,
  FilesLookupErrorCode,
  FilesSaveErrorCode,
  FilesUploadErrorCode,
  StoredFile,
  UploadState,
  UploadStatus,
} from "./contract.js";
export { filesMessages, getFilesErrorMessage, type FilesMessages } from "./messages/index.js";
export { DEFAULT_FILE_KIND, FILE_KIND_PATTERN, type FilesOptions, type FilesOptionsInput } from "./options.js";
export { files as filesTable } from "./schema.js";
export { isFileStorage, type FileBody, type FileStorage, type StorageCheck } from "./storage.js";
