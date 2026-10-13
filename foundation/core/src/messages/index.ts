import type { Dictionaries } from "../i18n.js";
import { en } from "./en.js";

export type CoreMessages = typeof en;

/** Copy for core's own error codes (`core.<key>` → `errors.<key>`). */
export const coreMessages: Dictionaries<CoreMessages> = { en };
