import { en } from "./en.js";

export type AnalyticsMessages = typeof en;

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const analyticsMessages = { en };
