import { en } from "./en.js";

export type BackupMessages = typeof en;

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const backupMessages = { en };
