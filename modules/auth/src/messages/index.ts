import type { AuthFormErrorCode } from "../contract.js";
import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const authMessages = { en };

type EnglishMessages = typeof en;
type AuthErrorCopy = EnglishMessages["errors"]["auth"];
type OidcErrorName = "oidc_failed" | "oidc_cancelled" | "oidc_not_allowed" | "oidc_no_account";

/**
 * One locale's copy. The OpenID Connect keys (`oidc`, `errors.auth.oidc_*`) are optional, so a dictionary written
 * before them still compiles; a missing one reads the English copy.
 */
export type AuthMessages = Omit<EnglishMessages, "oidc" | "errors"> & {
  readonly oidc?: EnglishMessages["oidc"];
  readonly errors: Omit<EnglishMessages["errors"], "auth"> & {
    readonly auth: Omit<AuthErrorCopy, OidcErrorName> & Partial<Pick<AuthErrorCopy, OidcErrorName>>;
  };
};

/** The OpenID Connect copy of `messages`, or the English one when the dictionary has none. */
export function getOidcMessages(messages: AuthMessages): EnglishMessages["oidc"] {
  return messages.oidc ?? en.oidc;
}

/**
 * The copy for an error code: the dictionary's, else the English one (a key the dictionary predates); an unknown code
 * gets the dictionary's generic failure.
 */
export function getAuthErrorMessage(messages: AuthMessages, code: AuthFormErrorCode): string {
  return findErrorCopy(messages.errors, code) ?? findErrorCopy(en.errors, code) ?? messages.errors.core.unexpected;
}

function findErrorCopy(errors: AuthMessages["errors"], code: string): string | undefined {
  const [namespace, name] = code.split(".", 2) as [string, string];
  const group: Readonly<Record<string, string | undefined>> | undefined = (errors as Readonly<Record<string, Readonly<Record<string, string | undefined>>>>)[namespace];
  return group !== undefined && Object.hasOwn(group, name) ? group[name] : undefined;
}
