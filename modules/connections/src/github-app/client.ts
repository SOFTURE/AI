// The GitHub App calls an app needs to let its users connect their own repositories: an installation's details and an
// installation access token (as the App, with its JWT), the repositories an installation token reaches, the code
// exchange of the App's user authorization, and the repositories of one installation a user can reach (as the user).
// Stateless: the app keeps the installation id with its own records (it is no secret) and mints a token when it needs
// one. Every call goes through core's `requestJson` (timeout, no redirect followed, failures as codes) and never puts
// a token, the key or GitHub's message into an error.
import { err, ok, requestJson, type Err, type FetchFunction, type HttpJsonFailure, type Ok } from "@softure-ai/core";
import { z } from "zod";
import { createGithubAppJwt, type GithubAppCredentials, type GithubAppKeyInvalid } from "./jwt.js";

export const GITHUB_API_URL = "https://api.github.com";
export const GITHUB_OAUTH_URL = "https://github.com";
const API_VERSION = "2022-11-28";

/** Where and how the calls go; tests pass a fake's `fetch`. */
export interface GithubAppCallOptions {
  readonly fetch?: FetchFunction;
  /** Default `https://api.github.com` (a GitHub Enterprise Server: `https://<host>/api/v3`). */
  readonly apiUrl?: string;
  /** Default 10 000. */
  readonly timeoutMs?: number;
  readonly now?: () => Date;
}

export type GithubAppFailureCode =
  /** The installation, repository or grant does not exist, or this credential cannot see it (GitHub answers 404). */
  | "connections.github_app_not_found"
  /** GitHub refused the credential: a wrong or expired token, a JWT it does not accept, a suspended installation. */
  | "connections.github_app_rejected"
  | "connections.github_app_rate_limited"
  /** A network failure, a timeout or a 5xx: worth retrying. */
  | "connections.github_app_unavailable"
  /** An answer this client cannot read. */
  | "connections.github_app_unexpected";

export type GithubAppFailure = Err<GithubAppFailureCode> & {
  /** GitHub's status; null when no answer came. */
  readonly status: number | null;
  /** From `Retry-After` on a rate limit or an outage; null otherwise. */
  readonly retryAfterSeconds: number | null;
};

/** A call's answer: the value, or a failure that carries GitHub's status and `Retry-After`. */
export type GithubAppResult<T> = Ok<T> | GithubAppFailure;

export interface GithubAccount {
  readonly id: number;
  readonly login: string;
  /** `User` or `Organization`. */
  readonly type: string;
}

export interface GithubAppInstallation {
  readonly id: number;
  readonly appId: number;
  readonly account: GithubAccount | null;
  /** `all` repositories of the account, or the `selected` ones. */
  readonly repositorySelection: "all" | "selected";
  /** Permission name to level (`contents: "read"`, `metadata: "read"`). */
  readonly permissions: Readonly<Record<string, string>>;
  readonly isSuspended: boolean;
}

export interface GithubInstallationToken {
  readonly token: string;
  readonly expiresAt: Date;
  readonly permissions: Readonly<Record<string, string>>;
}

export interface GithubRepository {
  readonly id: number;
  readonly name: string;
  /** `owner/name`. */
  readonly fullName: string;
  readonly ownerLogin: string;
  readonly isPrivate: boolean;
  readonly defaultBranch: string;
}

export interface GithubRepositoryPage {
  readonly totalCount: number;
  /** The first page only (up to 100); `totalCount` tells whether there are more. */
  readonly repositories: readonly GithubRepository[];
}

const accountSchema = z.object({ id: z.number().int(), login: z.string(), type: z.string() });
const permissionsSchema = z.record(z.string(), z.string());

const installationSchema = z.object({
  id: z.number().int().positive(),
  app_id: z.number().int(),
  account: accountSchema.nullish(),
  repository_selection: z.enum(["all", "selected"]),
  permissions: permissionsSchema.default({}),
  suspended_at: z.string().nullish(),
});

const tokenSchema = z.object({
  token: z.string().min(1).max(4096),
  expires_at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  permissions: permissionsSchema.default({}),
});

const repositorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({ login: z.string() }),
  private: z.boolean(),
  default_branch: z.string().min(1),
});

const repositoryPageSchema = z.object({ total_count: z.number().int().nonnegative(), repositories: z.array(repositorySchema) });

const userTokenSchema = z.union([
  z.object({ access_token: z.string().min(1).max(4096) }),
  z.object({ error: z.string().max(100) }),
]);

/** The installation as the App sees it. `connections.github_app_not_found` once it was uninstalled. */
export async function getGithubAppInstallation(
  credentials: GithubAppCredentials,
  installationId: number,
  options: GithubAppCallOptions = {},
): Promise<GithubAppResult<GithubAppInstallation> | GithubAppKeyInvalid> {
  const jwt = await createGithubAppJwt(credentials, options);
  if (!jwt.ok) return jwt;
  const answer = await requestJson({
    url: `${apiUrl(options)}/app/installations/${String(installationId)}`,
    headers: apiHeaders(jwt.value),
    schema: installationSchema,
    ...callOptions(options),
  });
  if (!answer.ok) return toFailure(answer);
  const body = answer.value;
  return ok({
    id: body.id,
    appId: body.app_id,
    account: body.account ?? null,
    repositorySelection: body.repository_selection,
    permissions: body.permissions,
    isSuspended: body.suspended_at !== null && body.suspended_at !== undefined,
  });
}

/**
 * An installation access token (an hour long), optionally narrowed to some repositories and permissions: pass the
 * least the call needs (`permissions: { contents: "read" }`, `repositoryIds: [id]`). Mint one per unit of work; it is
 * not stored.
 */
export async function createGithubInstallationToken(
  credentials: GithubAppCredentials,
  installationId: number,
  options: GithubAppCallOptions & { readonly repositoryIds?: readonly number[]; readonly permissions?: Readonly<Record<string, string>> } = {},
): Promise<GithubAppResult<GithubInstallationToken> | GithubAppKeyInvalid> {
  const jwt = await createGithubAppJwt(credentials, options);
  if (!jwt.ok) return jwt;
  const body: Record<string, unknown> = {};
  if (options.repositoryIds !== undefined) body.repository_ids = [...options.repositoryIds];
  if (options.permissions !== undefined) body.permissions = { ...options.permissions };
  const answer = await requestJson({
    url: `${apiUrl(options)}/app/installations/${String(installationId)}/access_tokens`,
    method: "POST",
    body,
    headers: apiHeaders(jwt.value),
    schema: tokenSchema,
    ...callOptions(options),
  });
  if (!answer.ok) return toFailure(answer);
  // A write may answer without a body; GitHub always sends the token.
  if (answer.value === undefined) return failure("connections.github_app_unexpected", null, null);
  return ok({ token: answer.value.token, expiresAt: new Date(answer.value.expires_at), permissions: answer.value.permissions });
}

/** The repositories an installation token reaches (the first 100). */
export async function listGithubInstallationRepositories(
  installationToken: string,
  options: GithubAppCallOptions = {},
): Promise<GithubAppResult<GithubRepositoryPage>> {
  return readRepositoryPage(`${apiUrl(options)}/installation/repositories?per_page=100`, installationToken, options);
}

/**
 * The repositories of one installation that the signed-in user can reach, read with the user's token: the proof that
 * an installation id arriving in a redirect belongs to this user (an id in a URL can be anyone's).
 * `connections.github_app_not_found` when the user cannot reach the installation.
 */
export async function listGithubUserInstallationRepositories(
  userToken: string,
  installationId: number,
  options: GithubAppCallOptions = {},
): Promise<GithubAppResult<GithubRepositoryPage>> {
  return readRepositoryPage(`${apiUrl(options)}/user/installations/${String(installationId)}/repositories?per_page=100`, userToken, options);
}

export interface GithubUserCodeExchange {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly code: string;
  readonly redirectUri: string;
  /** The PKCE verifier, when the authorize URL carried a challenge. */
  readonly codeVerifier?: string;
}

/**
 * Exchanges the code of the App's user authorization (`/login/oauth/authorize`) for a user access token. Use the token
 * for the call that needs it and drop it; GitHub answers a spent or wrong code with `connections.github_app_rejected`.
 */
export async function exchangeGithubUserCode(
  exchange: GithubUserCodeExchange,
  options: GithubAppCallOptions & { readonly oauthUrl?: string } = {},
): Promise<GithubAppResult<string>> {
  const form = new URLSearchParams({
    client_id: exchange.clientId,
    client_secret: exchange.clientSecret,
    code: exchange.code,
    redirect_uri: exchange.redirectUri,
  });
  if (exchange.codeVerifier !== undefined) form.set("code_verifier", exchange.codeVerifier);
  const answer = await requestJson({
    url: `${(options.oauthUrl ?? GITHUB_OAUTH_URL).replace(/\/+$/, "")}/login/oauth/access_token`,
    method: "POST",
    form,
    headers: { accept: "application/json" },
    schema: userTokenSchema,
    ...callOptions(options),
  });
  if (!answer.ok) return toFailure(answer);
  if (answer.value === undefined) return failure("connections.github_app_unexpected", null, null);
  // GitHub answers an OAuth error with status 200.
  if ("error" in answer.value) return failure("connections.github_app_rejected", 200, null);
  return ok(answer.value.access_token);
}

async function readRepositoryPage(url: string, token: string, options: GithubAppCallOptions): Promise<GithubAppResult<GithubRepositoryPage>> {
  const answer = await requestJson({ url, headers: apiHeaders(token), schema: repositoryPageSchema, ...callOptions(options) });
  if (!answer.ok) return toFailure(answer);
  return ok({ totalCount: answer.value.total_count, repositories: answer.value.repositories.map(toRepository) });
}

function toRepository(body: z.output<typeof repositorySchema>): GithubRepository {
  return {
    id: body.id,
    name: body.name,
    fullName: body.full_name,
    ownerLogin: body.owner.login,
    isPrivate: body.private,
    defaultBranch: body.default_branch,
  };
}

function apiHeaders(bearer: string): Record<string, string> {
  return { accept: "application/vnd.github+json", authorization: `Bearer ${bearer}`, "x-github-api-version": API_VERSION };
}

function apiUrl(options: GithubAppCallOptions): string {
  return (options.apiUrl ?? GITHUB_API_URL).replace(/\/+$/, "");
}

function callOptions(options: GithubAppCallOptions): { fetch?: FetchFunction; timeoutMs?: number } {
  return {
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  };
}

/** core's HTTP failure as this client's code: 404 not found, 401/403 rejected, 429 rate limited, 5xx unavailable. */
export function toFailure(answer: HttpJsonFailure): GithubAppFailure {
  const retryAfter = "retryAfterSeconds" in answer ? answer.retryAfterSeconds : null;
  if (answer.status === 404) return failure("connections.github_app_not_found", 404, null);
  switch (answer.error) {
    case "core.http_refused":
      return failure("connections.github_app_rejected", answer.status, null);
    case "core.http_rate_limited":
      return failure("connections.github_app_rate_limited", answer.status, retryAfter);
    case "core.http_unreachable":
    case "core.http_unavailable":
      return failure("connections.github_app_unavailable", answer.status, retryAfter);
    default:
      return failure("connections.github_app_unexpected", answer.status, null);
  }
}

function failure(code: GithubAppFailureCode, status: number | null, retryAfterSeconds: number | null): GithubAppFailure {
  return { ...err(code), status, retryAfterSeconds };
}
