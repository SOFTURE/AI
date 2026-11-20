import type { DeleteAccountErrorCode } from "../contract.js";
import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const privacyMessages = { en };

type EnglishMessages = typeof en;
type ReauthenticationKey = "confirmWith" | "confirmWithLead" | "confirmedWith";
type PrivacyErrorCopy = EnglishMessages["errors"]["privacy"];

/**
 * One locale's copy. The keys of the provider re-authentication (`delete.confirmWith*`, `delete.confirmedWith`,
 * `errors.privacy.reauthentication_required`) are optional, so a dictionary written before them still compiles; a
 * missing one reads the English copy.
 */
export type PrivacyMessages = Omit<EnglishMessages, "delete" | "errors"> & {
  readonly delete: Omit<EnglishMessages["delete"], ReauthenticationKey> & Partial<Pick<EnglishMessages["delete"], ReauthenticationKey>>;
  readonly errors: Omit<EnglishMessages["errors"], "privacy"> & {
    readonly privacy: Omit<PrivacyErrorCopy, "reauthentication_required"> & Partial<Pick<PrivacyErrorCopy, "reauthentication_required">>;
  };
};

/** The re-authentication copy of the delete form: the dictionary's, else the English one. */
export function getReauthenticationMessages(messages: PrivacyMessages): Pick<EnglishMessages["delete"], ReauthenticationKey> {
  return {
    confirmWith: messages.delete.confirmWith ?? en.delete.confirmWith,
    confirmWithLead: messages.delete.confirmWithLead ?? en.delete.confirmWithLead,
    confirmedWith: messages.delete.confirmedWith ?? en.delete.confirmedWith,
  };
}

/**
 * The copy for an error code: the dictionary's, else the English one (a key the dictionary predates); an unknown code
 * gets the dictionary's generic failure.
 */
export function getPrivacyErrorMessage(messages: PrivacyMessages, code: DeleteAccountErrorCode): string {
  return findErrorCopy(messages.errors, code) ?? findErrorCopy(en.errors, code) ?? messages.errors.core.unexpected;
}

function findErrorCopy(errors: PrivacyMessages["errors"], code: string): string | undefined {
  const separator = code.lastIndexOf(".");
  const namespace = code.slice(0, separator);
  const name = code.slice(separator + 1);
  const groups = errors as Readonly<Record<string, Readonly<Record<string, string | undefined>>>>;
  const group = Object.hasOwn(groups, namespace) ? groups[namespace] : undefined;
  return group !== undefined && Object.hasOwn(group, name) ? group[name] : undefined;
}
