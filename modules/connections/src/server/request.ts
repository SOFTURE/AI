// `requestWithConnection`: one call to a provider's API with a stored credential of any kind. It sets the
// `Authorization` header, calls `requestJson` and returns its result unchanged, except on a 401: with OAuth the token
// is refreshed once (only while the stored token is still the refused one, so overlapping callers spend one refresh)
// and the call is retried once; a second 401, or a 401 for an API key or Basic credential, reports the credential
// rejected and answers `connections.reconnect_required`.
import {
  err,
  requestJson,
  type Err,
  type HttpJsonAnswer,
  type HttpJsonFailure,
  type Ok,
  type RequestJsonReadHeadersOptions,
  type RequestJsonReadOptions,
  type RequestJsonSchemaOptions,
  type RequestJsonWriteOptions,
} from "@softure-ai/core";
import type { z } from "zod";
import type { ConnectionsTokenErrorCode } from "../contract.js";
import { DEFAULT_ACCOUNT_ID } from "../options.js";
import { getAuthorizationHeader, getCredential, reportCredentialRejected, type ProviderAccountInput } from "./credentials.js";
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
 * `/server`, the account alone in `/next`). The `Authorization` header is set by the helper and replaces the
 * caller's own.
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
  const target = { provider: account.provider, accountId: account.accountId ?? DEFAULT_ACCOUNT_ID };
  const found = findProvider(ctx.config, target.provider, target.accountId);
  if (!found.ok) return found;

  if (found.value.kind !== "oauth") {
    const credential = await getCredential(ctx, target);
    if (!credential.ok) return credential;
    const answer = await callJson(withAuthorization(options, getAuthorizationHeader(credential.value)));
    return isUnauthorized(answer) ? rejectCredential(ctx, target) : answer;
  }

  const token = await getAccessToken(ctx, target);
  if (!token.ok) return token;
  const first = await callJson(withAuthorization(options, getAuthorizationHeader({ kind: "oauth", accessToken: token.value.accessToken })));
  if (!isUnauthorized(first)) return first;

  const replaced = await replaceRejectedToken(ctx, { ...target, rejectedToken: token.value.accessToken });
  if (!replaced.ok) return replaced;
  // No refresh token to get another one with: the refused token is all there is.
  if (replaced.value.accessToken === token.value.accessToken) return rejectCredential(ctx, target);
  const second = await callJson(withAuthorization(options, getAuthorizationHeader({ kind: "oauth", accessToken: replaced.value.accessToken })));
  return isUnauthorized(second) ? rejectCredential(ctx, target) : second;
}

/** Calls a provider's API with the stored credential of `account`; see the module comment for the 401 handling. */
export const requestWithConnection = sendWithConnection as RequestWithConnection<[ctx: ConnectionsContext, account: ProviderAccountInput]>;

function isUnauthorized(answer: Ok<unknown> | HttpJsonFailure): boolean {
  return !answer.ok && answer.status === 401;
}

async function rejectCredential(ctx: ConnectionsContext, account: ProviderAccountInput): Promise<ConnectionRequestFailure> {
  const reported = await reportCredentialRejected(ctx, account);
  return reported.ok ? err("connections.reconnect_required") : reported;
}

/**
 * The options with the `Authorization` header replaced. The headers stay a list of pairs: a `Headers` built here
 * would throw a message quoting an invalid value, outside `requestJson`'s try that keeps such messages in.
 */
function withAuthorization(options: ConnectionRequestOptions, authorization: string): ConnectionRequestOptions {
  const pairs: [string, string][] = [];
  const { headers } = options;
  if (headers instanceof Headers) headers.forEach((value, name) => void pairs.push([name, value]));
  else if (Array.isArray(headers)) pairs.push(...headers.map(([name, value]): [string, string] => [String(name), String(value)]));
  else if (headers !== undefined) pairs.push(...Object.entries(headers));
  return { ...options, headers: [...pairs.filter(([name]) => name.toLowerCase() !== "authorization"), ["authorization", authorization]] };
}
