import type { WaitlistFormErrorCode } from "../contract.js";
import { en } from "./en.js";
import { pl } from "./pl.js";

export type WaitlistMessages = typeof en;

/** Complete default dictionaries; apps pass partial overrides per locale. */
export const waitlistMessages = { en, pl };

/** The copy for an error code; an unknown code gets the generic failure. */
export function getWaitlistErrorMessage(messages: WaitlistMessages, code: WaitlistFormErrorCode): string {
  const separator = code.lastIndexOf(".");
  const namespace = code.slice(0, separator);
  const name = code.slice(separator + 1);
  const groups = messages.errors as Readonly<Record<string, Readonly<Record<string, string>>>>;
  const group = Object.hasOwn(groups, namespace) ? groups[namespace] : undefined;
  return (group !== undefined && Object.hasOwn(group, name) ? group[name] : undefined) ?? messages.errors.core.unexpected;
}
