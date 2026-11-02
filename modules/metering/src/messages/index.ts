import type { MeteringErrorCode } from "../contract.js";
import { en } from "./en.js";

export type MeteringMessages = typeof en;

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const meteringMessages = { en };

/** The text of an error code in `messages` (the app's dictionary, or the built-in English one). */
export function getMeteringErrorMessage(code: MeteringErrorCode, messages: MeteringMessages = en): string {
  return messages.errors[code];
}
