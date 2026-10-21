// The calls to a provider's token and revocation endpoints (RFC 6749 §4.1.3, §6; RFC 7009): a form-encoded
// POST that asks for JSON, with the same rules as core's `requestJson`: a timeout, no redirect followed (the
// client secret never reaches another host), and failures as codes. A caught error's message is never read,
// since it can quote the URL, and a provider's error description is never kept, since some echo the token.
// The OAuth error code (`invalid_grant`) is read from any answer, including a 200 (GitHub answers errors so).
import type { FetchFunction } from "@softure-ai/core";
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
  if (answer.kind === "failed") return answer;
  const failure = readOAuthError(answer.body, answer.status);
  if (failure !== null) return failure;
  if (answer.status < 200 || answer.status >= 300) return { kind: "failed", status: answer.status };
  const parsed = tokenBodySchema.safeParse(answer.body);
  if (!parsed.success) return { kind: "failed", status: answer.status };
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
  return answer.kind === "answered" && answer.status >= 200 && answer.status < 300;
}

type FormAnswer = { readonly kind: "answered"; readonly status: number; readonly body: unknown } | { readonly kind: "failed"; readonly status: number | null };

async function postForm(url: string, options: TokenCallOptions): Promise<FormAnswer> {
  const body = new URLSearchParams(options.params);
  const headers = new Headers({ accept: "application/json", "content-type": "application/x-www-form-urlencoded" });
  if (options.provider.clientAuth === "basic" && options.client.clientSecret !== null) {
    // RFC 6749 §2.3.1: both parts form-encoded before the Basic encoding.
    const user = encodeURIComponent(options.client.clientId);
    const password = encodeURIComponent(options.client.clientSecret);
    headers.set("authorization", `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`);
  } else {
    body.set("client_id", options.client.clientId);
    if (options.client.clientSecret !== null) body.set("client_secret", options.client.clientSecret);
  }

  let response: Response;
  try {
    response = await options.fetch(url, {
      method: "POST",
      headers,
      body: body.toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch {
    // Network error or timeout; the error's text can quote the URL.
    return { kind: "failed", status: null };
  }
  const { status } = response;
  if (response.type === "opaqueredirect" || (status >= 300 && status < 400) || status === 429 || status >= 500) {
    await response.body?.cancel().catch(() => undefined);
    return { kind: "failed", status };
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { kind: "failed", status };
  }
  if (text.trim() === "") return { kind: "answered", status, body: null };
  try {
    return { kind: "answered", status, body: JSON.parse(text) as unknown };
  } catch {
    return { kind: "failed", status };
  }
}

function readOAuthError(body: unknown, status: number): TokenCallResult | null {
  const parsed = errorBodySchema.safeParse(body);
  return parsed.success ? { kind: "oauth_error", error: parsed.data.error, status } : null;
}
