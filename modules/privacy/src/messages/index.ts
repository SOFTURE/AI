import type { DeleteAccountErrorCode } from "../contract.js";
import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const privacyMessages = { en };

export type PrivacyMessages = typeof en;

/** The copy for an error code; an unknown code gets the generic failure. */
export function getPrivacyErrorMessage(messages: PrivacyMessages, code: DeleteAccountErrorCode): string {
  const separator = code.lastIndexOf(".");
  const namespace = code.slice(0, separator);
  const name = code.slice(separator + 1);
  const groups = messages.errors as Readonly<Record<string, Readonly<Record<string, string>>>>;
  const group = Object.hasOwn(groups, namespace) ? groups[namespace] : undefined;
  return (group !== undefined && Object.hasOwn(group, name) ? group[name] : undefined) ?? messages.errors.core.unexpected;
}
