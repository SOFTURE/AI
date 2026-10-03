import type { MailingErrorCode } from "../contract.js";
import { en } from "./en.js";
import { pl } from "./pl.js";

/** Complete default dictionaries; apps pass partial overrides per locale. */
export const mailingMessages = { en, pl };

export type MailingMessages = typeof en;

/** The copy for a mailing error code; a code the dictionary does not know reads as `unavailable`. */
export function getMailingErrorMessage(messages: MailingMessages, code: MailingErrorCode): string {
  const group: Readonly<Record<string, string>> = messages.errors.mailing;
  const name = code.slice("mailing.".length);
  return (Object.hasOwn(group, name) ? group[name] : undefined) ?? messages.errors.mailing.unavailable;
}
