// The authorization code exchange at the provider's token endpoint (RFC 6749 §4.1.3, with the PKCE verifier of
// RFC 7636): a form POST through core's `requestJson`, which follows no redirect, so the client secret never reaches
// another host. Only the ID token is read; the access token is not kept.
import { requestJson } from "@softure-ai/core";
import { z } from "zod";
import type { OpenIdConnectProvider } from "../../options.js";
import { getAuthOptions } from "../options.js";
import { passed, refused, type Checked, type OidcClient, type OidcContext } from "./context.js";

const tokenBodySchema = z.object({ id_token: z.string().min(1).max(16_384) });
// Only an RFC 6749 error code shape is read (it goes to the log); any other body is just a failed call.
const errorBodySchema = z.object({ error: z.string().regex(/^[a-z_]{1,64}$/) });


export interface TokenExchangeInput {
  readonly provider: OpenIdConnectProvider;
  readonly client: OidcClient;
  readonly tokenEndpoint: string;
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
}

/** The ID token for `code`, or the reason (for the log): the OAuth error code or core's failure code. */
export async function exchangeCode(ctx: OidcContext, input: TokenExchangeInput): Promise<Checked<string>> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const headers = new Headers();
  if (input.provider.clientAuth === "basic" && input.client.clientSecret !== null) {
    // RFC 6749 §2.3.1: both parts form-encoded before the Basic encoding.
    const user = encodeURIComponent(input.client.clientId);
    const password = encodeURIComponent(input.client.clientSecret);
    headers.set("authorization", `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`);
  } else {
    form.set("client_id", input.client.clientId);
    if (input.client.clientSecret !== null) form.set("client_secret", input.client.clientSecret);
  }
  const options = getAuthOptions(ctx.config).oidc;
  const answer = await requestJson({
    url: input.tokenEndpoint,
    method: "POST",
    form,
    headers,
    schema: tokenBodySchema,
    errorSchema: errorBodySchema,
    fetch: options.fetch,
    timeoutMs: options.httpTimeoutMs,
    clock: ctx.clock,
  });
  if (answer.ok) {
    // A write answered with no body is `ok(undefined)`; a token endpoint must answer one.
    return answer.value === undefined ? refused("token empty_answer") : passed(answer.value.id_token);
  }
  return refused(`token ${answer.errorBody?.error ?? answer.error}`);
}
