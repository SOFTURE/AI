import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const opsMessages = { en };

export type OpsMessages = typeof en;
