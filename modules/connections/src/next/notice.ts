// The query the callback route leaves on the page's URL: which connection succeeded, or which code failed.
import { ACCOUNT_ID_PATTERN, PROVIDER_ID_PATTERN } from "../options.js";

export const CONNECTED_PARAM = "connected";
export const ERROR_PARAM = "error";

const ERROR_CODE_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*$/;

export type PageNotice =
  | { readonly kind: "connected"; readonly provider: string; readonly accountId: string }
  | { readonly kind: "error"; readonly code: string }
  | { readonly kind: "none" };

/** The notice in the page's query; a value of the wrong shape is ignored, so nothing arbitrary is echoed. */
export function readPageNotice(params: URLSearchParams): PageNotice {
  const error = params.get(ERROR_PARAM);
  if (error !== null && error.length <= 100 && ERROR_CODE_PATTERN.test(error)) return { kind: "error", code: error };
  const connected = params.get(CONNECTED_PARAM);
  const [provider, accountId, extra] = connected?.split("/") ?? [];
  if (provider !== undefined && accountId !== undefined && extra === undefined && PROVIDER_ID_PATTERN.test(provider) && ACCOUNT_ID_PATTERN.test(accountId)) {
    return { kind: "connected", provider, accountId };
  }
  return { kind: "none" };
}
