// GitHub sign-in through an OAuth App (docs.github.com, "Authorizing OAuth apps"). GitHub is no OpenID Connect
// provider: the code buys an access token, and the account (`/user`) and its emails (`/user/emails`) come from the API
// with that token. Every call goes through core's `requestJson`, which follows no redirect, to fixed https endpoints;
// the access token is used for those two calls and never stored or logged.
import { requestJson } from "@softure-ai/core";
import { z } from "zod";
import type { GithubProvider } from "../../options.js";
import { getAuthOptions } from "../options.js";
import { passed, refused, type Checked, type OidcClient, type OidcContext } from "./context.js";
import { toDisplayName } from "./id-token.js";

export const GITHUB_AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
export const GITHUB_API_ORIGIN = "https://api.github.com";
/** `read:user` for the profile, `user:email` for private and unverified-flagged emails. */
export const GITHUB_REQUIRED_SCOPES = ["read:user", "user:email"];

const API_HEADERS = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "softure-ai-auth" };

// GitHub answers an OAuth error with status 200 and `{ error }`, so both shapes are read from a success.
const tokenBodySchema = z.union([
  z.object({ access_token: z.string().min(1).max(1024) }),
  z.object({ error: z.string().regex(/^[a-z_]{1,64}$/) }),
]);
const errorBodySchema = z.object({ error: z.string().regex(/^[a-z_]{1,64}$/) });

const userSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().max(64),
  // Best effort, like the ID token's profile claims: a malformed name is dropped.
  name: z.unknown().optional(),
});

const emailsSchema = z
  .array(z.object({ email: z.string().max(254), primary: z.boolean(), verified: z.boolean() }))
  .max(100);

export interface GithubAccount {
  /** GitHub's numeric user id: stable across a login rename. */
  readonly subject: string;
  /** `name`, else `login`, normalized. */
  readonly displayName: string | null;
  /** The verified emails, trimmed and lowercased, the primary first. */
  readonly verifiedEmails: readonly string[];
}

export interface GithubTokenExchangeInput {
  readonly client: OidcClient;
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
}

function requestOptions(ctx: OidcContext) {
  const options = getAuthOptions(ctx.config).oidc;
  return { fetch: options.fetch, timeoutMs: options.httpTimeoutMs, clock: ctx.clock };
}

/** The access token for `code`, or the reason (for the log): GitHub's error code or core's failure code. */
export async function exchangeGithubCode(ctx: OidcContext, input: GithubTokenExchangeInput): Promise<Checked<string>> {
  if (input.client.clientSecret === null) return refused("token client_secret missing");
  const form = new URLSearchParams({
    client_id: input.client.clientId,
    client_secret: input.client.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const answer = await requestJson({
    url: GITHUB_TOKEN_ENDPOINT,
    method: "POST",
    form,
    schema: tokenBodySchema,
    errorSchema: errorBodySchema,
    ...requestOptions(ctx),
  });
  if (!answer.ok) return refused(`token ${answer.errorBody?.error ?? answer.error}`);
  if (answer.value === undefined) return refused("token empty_answer");
  return "error" in answer.value ? refused(`token ${answer.value.error}`) : passed(answer.value.access_token);
}

/** The account the access token belongs to, with its verified emails, or the reason (for the log) it could not be read. */
export async function readGithubAccount(ctx: OidcContext, accessToken: string): Promise<Checked<GithubAccount>> {
  const headers = { ...API_HEADERS, authorization: `Bearer ${accessToken}` };
  const user = await requestJson({ url: `${GITHUB_API_ORIGIN}/user`, headers, schema: userSchema, ...requestOptions(ctx) });
  if (!user.ok) return refused(`user ${user.error}`);
  const emails = await requestJson({ url: `${GITHUB_API_ORIGIN}/user/emails`, headers, schema: emailsSchema, ...requestOptions(ctx) });
  if (!emails.ok) return refused(`emails ${emails.error}`);
  const verified = emails.value
    .filter((entry) => entry.verified)
    .sort((a, b) => Number(b.primary) - Number(a.primary))
    .map((entry) => entry.email.trim().toLowerCase());
  return passed({
    subject: String(user.value.id),
    displayName: toDisplayName(user.value.name) ?? toDisplayName(user.value.login),
    verifiedEmails: [...new Set(verified)],
  });
}

/** The authorize URL's `scope` for GitHub: the required scopes and the entry's own, space separated. */
export function getGithubScopes(provider: GithubProvider): string {
  return [...new Set([...GITHUB_REQUIRED_SCOPES, ...provider.scopes])].join(" ");
}
