// The calls to a provider's token and revocation endpoints (RFC 6749 §4.1.3, §6; RFC 7009): a form-encoded
// POST that asks for JSON, sent through core's `requestJson`: a timeout, no redirect followed (the client secret
// never reaches another host), and failures as codes. A caught error's message is never read, since it can quote
// the URL, and a provider's error description is never kept, since some echo the token. The OAuth error code
// (`invalid_grant`) is read from a 2xx (GitHub answers errors so) or a 4xx answer, never from a 429 or a 5xx.
import { requestJson, type FetchFunction, type HttpJsonErrorBodyFailure } from "@softure-ai/core";
import { z } from "zod";
import type { OAuthProviderDefinition } from "../options.js";

/** What a token call came to. */
export type TokenCallResult =
  | { readonly kind: "tokens"; readonly tokens: TokenResponse }
  /** The provider answered an OAuth error (`invalid_grant`, `invalid_client`…). */
  | { readonly kind: "oauth_error"; readonly error: string; readonly status: number }
  /** Network failure, timeout, 429, 5xx, a redirect, or a body that is neither tokens nor an OAuth error. */
  | { readonly kind: "failed"; readonly status: number | null };

export interface TokenResponse {
  readonly accessToken: string;
  readonly tokenType: string;
  /** Seconds; null when the provider gave none (a token that does not expire). */
  readonly expiresIn: number | null;
  readonly refreshToken: string | null;
  readonly refreshTokenExpiresIn: number | null;
  /** The granted scopes; null when the answer has none (then the requested ones were granted). */
  readonly scope: string | null;
}

export interface ClientCredentials {
  readonly clientId: string;
  /** Null for a public client. */
  readonly clientSecret: string | null;
}

export interface TokenCallOptions {
  readonly provider: OAuthProviderDefinition;
  readonly client: ClientCredentials;
  readonly params: Readonly<Record<string, string>>;
  readonly fetch: FetchFunction;
  readonly timeoutMs: number;
}

const seconds = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().nonnegative());

const tokenBodySchema = z.object({
  access_token: z.string().min(1).max(16_384),
  token_type: z.string().min(1).max(40).optional(),
  expires_in: seconds.nullish(),
  refresh_token: z.string().min(1).max(16_384).nullish(),
  refresh_token_expires_in: seconds.nullish(),
  scope: z.string().max(10_000).nullish(),
});

const errorBodySchema = z.object({ error: z.string().regex(/^[\x20-\x7e]{1,100}$/) });

/** POSTs `params` to the provider's token endpoint and reads the tokens or the OAuth error. */
export async function requestTokens(options: TokenCallOptions): Promise<TokenCallResult> {
  const answer = await postForm(options.provider.tokenUrl, options);
  if (!answer.ok) return readFailure(answer);
  // A 2xx; `requestJson` does not say which, and no caller tells them apart.
  const status = 200;
  // GitHub answers an OAuth error with a 200.
  const error = errorBodySchema.safeParse(answer.value);
  if (error.success) return { kind: "oauth_error", error: error.data.error, status };
  const parsed = tokenBodySchema.safeParse(answer.value);
  if (!parsed.success) return { kind: "failed", status };
  const body = parsed.data;
  return {
    kind: "tokens",
    tokens: {
      accessToken: body.access_token,
      tokenType: body.token_type ?? "Bearer",
      expiresIn: body.expires_in ?? null,
      refreshToken: body.refresh_token ?? null,
      refreshTokenExpiresIn: body.refresh_token_expires_in ?? null,
      scope: body.scope ?? null,
    },
  };
}

/** RFC 7009: asks the provider to revoke `token`. Best effort: answers whether the provider took it. */
export async function revokeToken(options: TokenCallOptions & { readonly revokeUrl: string }): Promise<boolean> {
  const answer = await postForm(options.revokeUrl, options);
  return answer.ok;
}

function postForm(url: string, options: TokenCallOptions) {
  const form = new URLSearchParams(options.params);
  const headers = new Headers();
  if (options.provider.clientAuth === "basic" && options.client.clientSecret !== null) {
    // RFC 6749 §2.3.1: both parts form-encoded before the Basic encoding.
    const user = encodeURIComponent(options.client.clientId);
    const password = encodeURIComponent(options.client.clientSecret);
    headers.set("authorization", `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`);
  } else {
    form.set("client_id", options.client.clientId);
    if (options.client.clientSecret !== null) form.set("client_secret", options.client.clientSecret);
  }
  return requestJson({
    url,
    method: "POST",
    form,
    headers,
    fetch: options.fetch,
    timeoutMs: options.timeoutMs,
    errorSchema: errorBodySchema,
  });
}

/** An OAuth error from a 4xx answer (RFC 6749 §5.2); a rate limit or an outage never is one, whatever its body says. */
function readFailure(failure: HttpJsonErrorBodyFailure<z.output<typeof errorBodySchema>>): TokenCallResult {
  const isRetryable = failure.error === "core.http_rate_limited" || failure.error === "core.http_unavailable";
  if (failure.status !== null && failure.errorBody !== null && !isRetryable) {
    return { kind: "oauth_error", error: failure.errorBody.error, status: failure.status };
  }
  return { kind: "failed", status: failure.status };
}
