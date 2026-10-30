// Public API of @softure-ai/files: the module factory for softure.config.ts, its types, messages and table. The
// storage drivers and every database function are in `@softure-ai/files/server`, the link route in `/next`, the
// prune job in `/jobs` and the test helpers (an in-memory driver, link checks) in `/testing`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { filesMessages } from "./messages/index.js";
import { filesOptionsSchema } from "./options.js";
import { checkFilesHealth } from "./server/health.js";
import { filesPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "files";

/**
 * Enables stored files in `softure.config.ts`:
 * `files({ storage: createLocalStorage({ dir: "/data/files" }), quotaBytesPerOwner: 2 * 1024 ** 3 })`.
 */
export const files = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.2",
    dependsOn: { jobs: "^0.1.6?" },
    dbSchema: "files",
    tables: ["files"],
    env: [
      {
        name: "SOFTURE_FILES_LINK_KEYS",
        required: false,
        description:
          "Signing keyring for public file links: <id>:<base64 32 bytes>[,<id>:<key>...], the first one signs; needed only by createFileLink and the link route",
      },
    ],
    switches: [],
    routes: { links: "/f" },
    mount: [
      {
        kind: "route-handler",
        path: "app/f/[...link]/route.ts",
        export: "serveFileLinkRoute",
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

export type { ByteRange, FileLink, FilesErrorCode, FilesKeyErrorCode, FilesLookupErrorCode, FilesSaveErrorCode, StoredFile } from "./contract.js";
export { filesMessages, getFilesErrorMessage, type FilesMessages } from "./messages/index.js";
export { DEFAULT_FILE_KIND, FILE_KIND_PATTERN, type FilesOptions, type FilesOptionsInput } from "./options.js";
export { files as filesTable } from "./schema.js";
export { isFileStorage, type FileBody, type FileStorage, type StorageCheck } from "./storage.js";
