import type { BillingFormErrorCode } from "../contract.js";
import { en } from "./en.js";
import { pl } from "./pl.js";

export type BillingMessages = typeof en;

/** Complete default dictionaries; apps pass partial overrides per locale. */
export const billingMessages = { en, pl };

/** The copy for an error code; an unknown code gets the generic failure. */
export function getBillingErrorMessage(messages: BillingMessages, code: BillingFormErrorCode): string {
  const separator = code.lastIndexOf(".");
  const namespace = code.slice(0, separator);
  const name = code.slice(separator + 1);
  const groups = messages.errors as Readonly<Record<string, Readonly<Record<string, string>>>>;
  const group = Object.hasOwn(groups, namespace) ? groups[namespace] : undefined;
  return (group !== undefined && Object.hasOwn(group, name) ? group[name] : undefined) ?? messages.errors.core.unexpected;
}
