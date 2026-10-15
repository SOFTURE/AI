import type { DeliveryJobErrorCode, MailingErrorCode } from "../contract.js";
import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const mailingMessages = { en };

export type MailingMessages = typeof en;

/** The copy for a mailing error code; a code the dictionary does not know reads as `unavailable`. */
export function getMailingErrorMessage(messages: MailingMessages, code: MailingErrorCode | DeliveryJobErrorCode): string {
  const group: Readonly<Record<string, string>> = messages.errors.mailing;
  const name = code.slice("mailing.".length);
  return (Object.hasOwn(group, name) ? group[name] : undefined) ?? messages.errors.mailing.unavailable;
}
