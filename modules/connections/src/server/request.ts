// `requestWithConnection` (a JSON answer) and `downloadWithConnection` (a file): one call to a provider's API with a
// stored credential of any kind. It sets the credential's header (`Authorization`, or an API key provider's own
// `header`), calls `requestJson` (or `requestBytes`) and returns its result unchanged, except on a 401: with OAuth the
// token is refreshed once (only while the stored token is still the refused one, so overlapping callers spend one refresh)
// and the call is retried once; a second 401, or a 401 for an API key or Basic credential, reports the credential
// rejected and answers `connections.reconnect_required`.
import {
  err,
  requestBytes,
  requestJson,
  type Err,
  type HttpBytesAnswer,
  type HttpBytesFailure,
  type HttpJsonAnswer,
  type HttpJsonFailure,
  type Ok,
  type RequestJsonReadHeadersOptions,
  type RequestJsonReadOptions,
  type RequestJsonSchemaOptions,
  type RequestBytesOptions,
  type RequestJsonWriteOptions,
} from "@softure-ai/core";
import type { z } from "zod";
import type { ConnectionsTokenErrorCode } from "../contract.js";
import { DEFAULT_ACCOUNT_ID } from "../options.js";
import {
  formatCredentialHeader,
  getCredential,
  getCredentialPlacement,
  reportCredentialRejected,
  type CredentialHeader,
  type ProviderAccountInput,
} from "./credentials.js";
import { findProvider } from "./options.js";
import type { ConnectionsContext } from "./store.js";
import { getAccessToken, replaceRejectedToken } from "./tokens.js";

/** The credential could not be read, refreshed, or was rejected; the call was not made or not retried. */
export type ConnectionRequestFailure = Err<ConnectionsTokenErrorCode>;

/** The calls without `readHeaders`, whose value is the body itself. */
interface WithoutReadHeaders {
  readonly readHeaders?: undefined;
}

/**
 * The overloads of `requestJson`, after the arguments `P` that name the connection (`ctx` and the account in
 * `/server`, the account alone in `/next`). The credential's header (`Authorization`, or an API key provider's
 * `header`) is set by the helper and replaces the caller's header of that name.
 */
export interface RequestWithConnection<P extends readonly unknown[]> {
  <S extends z.ZodType, const H extends string>(
    ...args: [...P, options: RequestJsonSchemaOptions<S> & RequestJsonReadOptions & RequestJsonReadHeadersOptions<H>]
  ): Promise<Ok<HttpJsonAnswer<z.output<S>, H>> | HttpJsonFailure | ConnectionRequestFailure>;
  <S extends z.ZodType, const H extends string>(
    ...args: [...P, options: RequestJsonSchemaOptions<S> & RequestJsonWriteOptions & RequestJsonReadHeadersOptions<H>]
  ): Promise<Ok<HttpJsonAnswer<z.output<S> | undefined, H>> | HttpJsonFailure | ConnectionRequestFailure>;
  <const H extends string>(
    ...args: [...P, options: (RequestJsonReadOptions | RequestJsonWriteOptions) & RequestJsonReadHeadersOptions<H>]
  ): Promise<Ok<HttpJsonAnswer<unknown, H>> | HttpJsonFailure | ConnectionRequestFailure>;
  <S extends z.ZodType>(
    ...args: [...P, options: RequestJsonSchemaOptions<S> & RequestJsonReadOptions & WithoutReadHeaders]
  ): Promise<Ok<z.output<S>> | HttpJsonFailure | ConnectionRequestFailure>;
  <S extends z.ZodType>(
    ...args: [...P, options: RequestJsonSchemaOptions<S> & RequestJsonWriteOptions & WithoutReadHeaders]
  ): Promise<Ok<z.output<S> | undefined> | HttpJsonFailure | ConnectionRequestFailure>;
  (...args: [...P, options: (RequestJsonReadOptions | RequestJsonWriteOptions) & WithoutReadHeaders]): Promise<Ok<unknown> | HttpJsonFailure | ConnectionRequestFailure>;
}

/** What every overload accepts, as `requestJson`'s own implementation takes it. */
export type ConnectionRequestOptions = (RequestJsonReadOptions | RequestJsonWriteOptions) & {
  readonly schema?: z.ZodType;
  readonly readHeaders?: readonly string[];
};

export type ConnectionRequestResult = Ok<unknown> | HttpJsonFailure | ConnectionRequestFailure;

// The overloads of `requestJson` cannot take the union this wrapper forwards; the caller's overload already checked
// that the options fit one of them.
const callJson = requestJson as (options: ConnectionRequestOptions) => Promise<Ok<unknown> | HttpJsonFailure>;

/** The implementation behind both adapters' `requestWithConnection`. */
export async function sendWithConnection(ctx: ConnectionsContext, account: ProviderAccountInput, options: ConnectionRequestOptions): Promise<ConnectionRequestResult> {
  return callWithConnection(ctx, account, options, callJson);
}

/** Calls a provider's API with the stored credential of `account`; see the module comment for the 401 handling. */
export const requestWithConnection = sendWithConnection as RequestWithConnection<[ctx: ConnectionsContext, account: ProviderAccountInput]>;

/** What a call must answer for the 401 rule to read it: a success, or a failure with the HTTP status. */
type HttpCallResult = Ok<unknown> | (Err<`${string}.${string}`> & { readonly status: number | null });

/**
 * The credential path shared by every helper: `call` gets the options with the credential's header and is made again
 * once after an OAuth refresh; a 401 that stands reports the credential rejected.
 */
async function callWithConnection<O extends { readonly headers?: HeadersInit }, R extends HttpCallResult>(
  ctx: ConnectionsContext,
  account: ProviderAccountInput,
  options: O,
  call: (options: O) => Promise<R>,
): Promise<R | ConnectionRequestFailure> {
  const target = { provider: account.provider, accountId: account.accountId ?? DEFAULT_ACCOUNT_ID };
  const found = findProvider(ctx.config, target.provider, target.accountId);
  if (!found.ok) return found;

  if (found.value.kind !== "oauth") {
    const credential = await getCredential(ctx, target);
    if (!credential.ok) return credential;
    const answer = await call(withCredentialHeader(options, formatCredentialHeader(credential.value, getCredentialPlacement(found.value))));
    return isUnauthorized(answer) ? rejectCredential(ctx, target) : answer;
  }

  const token = await getAccessToken(ctx, target);
  if (!token.ok) return token;
  const first = await call(withCredentialHeader(options, formatCredentialHeader({ kind: "oauth", accessToken: token.value.accessToken })));
  if (!isUnauthorized(first)) return first;

  const replaced = await replaceRejectedToken(ctx, { ...target, rejectedToken: token.value.accessToken });
  if (!replaced.ok) return replaced;
  // No refresh token to get another one with: the refused token is all there is.
  if (replaced.value.accessToken === token.value.accessToken) return rejectCredential(ctx, target);
  const second = await call(withCredentialHeader(options, formatCredentialHeader({ kind: "oauth", accessToken: replaced.value.accessToken })));
  return isUnauthorized(second) ? rejectCredential(ctx, target) : second;
}

/** A download's answer: the bytes and content type, a `requestBytes` failure, or a credential failure. */
export type ConnectionDownloadResult = Ok<HttpBytesAnswer> | HttpBytesFailure | ConnectionRequestFailure;

/**
 * Downloads a file (`requestBytes` of core) with the stored credential of `account`: the same header, refresh and 401
 * rules as `requestWithConnection`, answering the body as a `Uint8Array` with its content type, under `maxBytes`.
 */
export async function downloadWithConnection(ctx: ConnectionsContext, account: ProviderAccountInput, options: RequestBytesOptions): Promise<ConnectionDownloadResult> {
  return callWithConnection(ctx, account, options, requestBytes);
}

function isUnauthorized(answer: HttpCallResult): boolean {
  return !answer.ok && answer.status === 401;
}

async function rejectCredential(ctx: ConnectionsContext, account: ProviderAccountInput): Promise<ConnectionRequestFailure> {
  const reported = await reportCredentialRejected(ctx, account);
  return reported.ok ? err("connections.reconnect_required") : reported;
}

/**
 * The options with the credential's header replaced (names compared case-insensitively). The headers stay a list of pairs: a `Headers` built here
 * would throw a message quoting an invalid value, outside `requestJson`'s try that keeps such messages in.
 */
function withCredentialHeader<O extends { readonly headers?: HeadersInit }>(options: O, credential: CredentialHeader): O {
  const pairs: [string, string][] = [];
  const { headers } = options;
  if (headers instanceof Headers) headers.forEach((value, name) => void pairs.push([name, value]));
  else if (Array.isArray(headers)) pairs.push(...headers.map(([name, value]): [string, string] => [String(name), String(value)]));
  else if (headers !== undefined) pairs.push(...Object.entries(headers));
  return { ...options, headers: [...pairs.filter(([name]) => name.toLowerCase() !== credential.name), [credential.name, credential.value]] };
}
