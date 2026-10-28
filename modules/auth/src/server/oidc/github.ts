// The protocol step of a GitHub sign-in (an OAuth App, not OpenID Connect): the code is exchanged at GitHub's fixed
// token endpoint, and the account is read from GitHub's API with the access token, which lives only in this call.
// Every request goes through core's `requestJson`, which follows no redirect, so neither the client secret nor the
// token reaches another host. Only verified emails count, the primary one first.
import { requestJson } from "@softure-ai/core";
import { z } from "zod";
import type { GithubProvider } from "../../options.js";
import { getAuthOptions } from "../options.js";
import { isAllowedEmail } from "./allowlist.js";
import { passed, refused, type Checked, type OidcClient, type OidcContext } from "./context.js";
import { toDisplayName } from "./id-token.js";

export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_USER_URL = "https://api.github.com/user";
export const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";
/** The profile (id, login, name) and the account's emails, verified flag included; nothing else. */
export const GITHUB_SCOPES = "read:user user:email";

// GitHub answers an OAuth error with status 200, so the error is read from a successful body too.
const tokenBodySchema = z.object({
  access_token: z.string().min(1).max(4096).optional(),
  error: z.string().regex(/^[a-z_]{1,64}$/).optional(),
});
const errorBodySchema = z.object({ error: z.string().regex(/^[a-z_]{1,64}$/) });
const userSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().max(100),
  name: z.string().nullable().optional(),
});
const emailsSchema = z.array(z.object({ email: z.string().max(320), primary: z.boolean(), verified: z.boolean() })).max(100);

export interface GithubSignIn {
  readonly provider: GithubProvider;
  readonly client: OidcClient;
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
}

/** What a GitHub sign-in says about the person. */
export interface GithubIdentity {
  /** The account's numeric id, as text: it survives a renamed login. */
  readonly subject: string;
  /** The first verified email the allowlist accepts, primary first; null when none does. */
  readonly email: string | null;
  /** `name`, else `login`, normalized. */
  readonly displayName: string | null;
}

/** The identity behind `code`, or the reason (for the log) it could not be read. */
export async function readGithubIdentity(ctx: OidcContext, input: GithubSignIn): Promise<Checked<GithubIdentity>> {
  const token = await exchangeGithubCode(ctx, input);
  if (!token.ok) return token;
  const headers = {
    authorization: `Bearer ${token.value}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "softure-ai-auth",
  };
  const user = await requestJson({ url: GITHUB_USER_URL, headers, schema: userSchema, ...requestOptions(ctx) });
  if (!user.ok) return refused(`user ${user.error}`);
  const emails = await requestJson({ url: GITHUB_EMAILS_URL, headers, schema: emailsSchema, ...requestOptions(ctx) });
  if (!emails.ok) return refused(`emails ${emails.error}`);
  return passed({
    subject: String(user.value.id),
    email: pickGithubEmail(input.provider, emails.value),
    displayName: toDisplayName(user.value.name) ?? toDisplayName(user.value.login),
  });
}

/** The first verified email, primary first, that the provider's allowlist accepts; null when none does. */
export function pickGithubEmail(
  provider: GithubProvider,
  emails: readonly { readonly email: string; readonly primary: boolean; readonly verified: boolean }[],
): string | null {
  const verified = emails.filter((entry) => entry.verified).sort((a, b) => Number(b.primary) - Number(a.primary));
  for (const entry of verified) {
    const email = entry.email.trim().toLowerCase();
    if (isAllowedEmail(provider, email, null)) return email;
  }
  return null;
}

async function exchangeGithubCode(ctx: OidcContext, input: GithubSignIn): Promise<Checked<string>> {
  const form = new URLSearchParams({
    client_id: input.client.clientId,
    client_secret: input.client.clientSecret ?? "",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const answer = await requestJson({
    url: GITHUB_TOKEN_URL,
    method: "POST",
    form,
    // Without it GitHub answers form-encoded.
    headers: { accept: "application/json", "user-agent": "softure-ai-auth" },
    schema: tokenBodySchema,
    errorSchema: errorBodySchema,
    ...requestOptions(ctx),
  });
  if (!answer.ok) return refused(`token ${answer.errorBody?.error ?? answer.error}`);
  if (answer.value === undefined) return refused("token empty_answer");
  if (answer.value.error !== undefined) return refused(`token ${answer.value.error}`);
  return answer.value.access_token === undefined ? refused("token no_access_token") : passed(answer.value.access_token);
}

function requestOptions(ctx: OidcContext) {
  const options = getAuthOptions(ctx.config).oidc;
  return { fetch: options.fetch, timeoutMs: options.httpTimeoutMs, clock: ctx.clock };
}
