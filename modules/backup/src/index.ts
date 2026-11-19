// Public API of @softure-ai/backup: the module factory for softure.config.ts (its migration creates backup.runs,
// the status the host run writes), the contract types and messages. The app reads the status through
// `@softure-ai/backup/server`; the host side (upload, restore, verify) is `@softure-ai/backup/offsite` and the
// `softure-backup` command.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { backupMessages } from "./messages/index.js";
import { checkRunsTable } from "./server/index.js";

export const MODULE_ID = "backup";

/** Adds the status table of the off-site backup: `modules: [backup()]` in `softure.config.ts`. */
export const backup = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.3",
    dependsOn: {},
    dbSchema: "backup",
    tables: ["runs"],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
    // The module's entries (the table, the health check, getLastBackup) run on either host; the off-site copy itself
    // runs on a VPS (deploy.sh maintain) or from a workflow (`softure-backup run`), never inside the app.
    runtimes: ["node", "workers"],
  },
  messages: backupMessages,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  health: checkRunsTable,
});

export {
  BACKUP_ERROR_CODES,
  BACKUP_RESULTS,
  type BackupErrorCode,
  type BackupKind,
  type BackupObject,
  type BackupResult,
  type BackupRun,
  type BackupStatus,
} from "./contract.js";
export { backupMessages, type BackupMessages } from "./messages/index.js";
export { backupSchema, runs } from "./schema.js";
