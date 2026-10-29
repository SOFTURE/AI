import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const pwaMessages = { en };

export type PwaMessages = typeof en;
