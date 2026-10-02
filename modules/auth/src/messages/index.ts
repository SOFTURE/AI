import type { AuthFormErrorCode } from "../contract.js";
import { en } from "./en.js";
import { pl } from "./pl.js";

/** Complete default dictionaries; apps pass partial overrides per locale. */
export const authMessages = { en, pl };

export type AuthMessages = typeof en;

/** The copy for an error code; an unknown code gets the generic failure. */
export function getAuthErrorMessage(messages: AuthMessages, code: AuthFormErrorCode): string {
  const [namespace, name] = code.split(".", 2) as [string, string];
  const group: Readonly<Record<string, string>> | undefined = (messages.errors as Readonly<Record<string, Readonly<Record<string, string>>>>)[namespace];
  return (group !== undefined && Object.hasOwn(group, name) ? group[name] : undefined) ?? messages.errors.core.unexpected;
}
