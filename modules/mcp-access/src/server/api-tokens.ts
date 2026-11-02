// Personal tokens for an app's plain HTTP routes (#961): a phone Shortcut, an automation tool or a
// script sends `Authorization: Bearer <prefix>…` and the route calls `requireApiToken`. They share the
// table, hashing, expiry, limit, privacy and prune with the MCP tokens (`tokens.ts`); the `kind`
// column keeps the two doors apart. Nothing here imports the MCP SDK: `@softure-ai/mcp-access/tokens`
// is for an app that has no MCP server.
import { err, errorLogLabel, getModule, ok, type Err, type Ok } from "@softure-ai/core";
import { consumeRateLimit, identifyClient, subjectKey } from "@softure-ai/security/server";
import type { ApiTokenIdentity, ApiTokenRefusal } from "../contract.js";
import { MAX_PRESENTED_TOKEN_LENGTH, type ApiTokenOptions } from "../options.js";
import { getMcpAccessOptions } from "./options.js";
import { findValidToken, insertToken, type McpAccessContext } from "./tokens.js";
import { isWritingEnabled } from "./writes-switch.js";

/** The bucket counted per client address before the token is looked up. */
export const API_RATE_LIMIT_BUCKET = "api";
/** The bucket counted per verified token. */
export const API_TOKEN_RATE_LIMIT_BUCKET = "api-token";

const BEARER_PREFIX = /^Bearer[ \t]+/i;
const NO_STORE = "no-store";

/** The app's API token settings, or null while `apiTokens` is unset. */
export function getApiTokenOptions(ctx: Pick<McpAccessContext, "config">): ApiTokenOptions | null {
  return getMcpAccessOptions(ctx.config).apiTokens ?? null;
}

/** Whether a presented value has the shape of one of the app's API tokens: its prefix and 32 base64url bytes. */
export function isApiTokenShape(options: ApiTokenOptions, token: string): boolean {
  if (token.length > MAX_PRESENTED_TOKEN_LENGTH || !token.startsWith(options.prefix)) return false;
  return /^[A-Za-z0-9_-]{43}$/.test(token.slice(options.prefix.length));
}

export interface IssueApiTokenInput {
  /** The auth user id of the owner, from the session. */
  readonly userId: string;
  readonly name: string;
  /** Scope names from the form: any values; unknown ones are refused. */
  readonly scopes: readonly string[];
}

export interface IssuedApiToken {
  readonly id: string;
  /** The plaintext: shown to the owner once, stored nowhere. */
  readonly token: string;
  readonly name: string;
  /** The scopes granted, in the order the app declares them. */
  readonly scopes: readonly string[];
  readonly expiresAt: Date;
}

export type IssueApiTokenResult =
  | Ok<IssuedApiToken>
  | Err<
      | "mcp-access.name_required"
      | "mcp-access.name_too_long"
      | "mcp-access.token_limit_reached"
      | "mcp-access.api_tokens_disabled"
      | "mcp-access.scope_required"
      | "mcp-access.scope_unknown"
    >;

/**
 * Issues an API token with the asked scopes. A scope the app does not declare is refused; a write
 * scope is granted only while `allowWrites` is on (left out otherwise), and a token needs at least
 * one scope left. Shares the per-account limit and lock with MCP tokens. Database failures propagate.
 */
export async function issueApiToken(ctx: McpAccessContext, input: IssueApiTokenInput): Promise<IssueApiTokenResult> {
  const apiOptions = getApiTokenOptions(ctx);
  if (apiOptions === null) return err("mcp-access.api_tokens_disabled");
  const asked = new Set(input.scopes);
  const declared = new Set(apiOptions.scopes.map((scope) => scope.name));
  if ([...asked].some((name) => !declared.has(name))) return err("mcp-access.scope_unknown");

  const { allowWrites } = getMcpAccessOptions(ctx.config);
  const granted = apiOptions.scopes.filter((scope) => asked.has(scope.name) && (scope.access === "read" || allowWrites));
  if (granted.length === 0) return err("mcp-access.scope_required");

  const scopes = granted.map((scope) => scope.name);
  const canWrite = granted.some((scope) => scope.access === "write");
  const result = await insertToken(ctx, { userId: input.userId, name: input.name, kind: "api", canWrite, scopes, prefix: apiOptions.prefix });
  if (!result.ok) return result;
  const { id, token, name, expiresAt } = result.value;
  return ok({ id, token, name, scopes, expiresAt });
}

/** The identity behind a valid API token. */
export interface VerifiedApiToken extends ApiTokenIdentity {
  readonly expiresAt: Date;
}

/**
 * The identity behind an API token, or null for anything unknown, revoked, expired, an MCP token or
 * any value without the app's prefix. Write scopes count only while writing is enabled (`allowWrites`
 * and the `mcp-access.writes_enabled` switch). Records the use like an MCP token. Database failures propagate.
 */
export async function verifyApiToken(ctx: McpAccessContext, token: string): Promise<VerifiedApiToken | null> {
  return (await checkApiToken(ctx, token))?.verified ?? null;
}

/** A verified token and the write scopes it holds that the writes switch keeps from it now. */
async function checkApiToken(ctx: McpAccessContext, token: string): Promise<{ verified: VerifiedApiToken; withheld: readonly string[] } | null> {
  const apiOptions = getApiTokenOptions(ctx);
  if (apiOptions === null || !isApiTokenShape(apiOptions, token)) return null;
  const row = await findValidToken(ctx, token, "api");
  if (row === null) return null;
  const isWriteAllowed = await isWritingEnabled(ctx);
  const writeScopes = new Set(apiOptions.scopes.filter((scope) => scope.access === "write").map((scope) => scope.name));
  const withheld = isWriteAllowed ? [] : row.scopes.filter((scope) => writeScopes.has(scope));
  return {
    verified: { userId: row.userId, tokenId: row.id, scopes: row.scopes.filter((scope) => !withheld.includes(scope)), expiresAt: row.expiresAt },
    withheld,
  };
}

export interface RequireApiTokenOptions {
  /** Every scope the route needs; each must be one the app declares in `apiTokens.scopes`. */
  readonly scopes: readonly string[];
}

/**
 * Checks a route's request for a valid API token with every scope in `scopes`, in this order:
 * the client is identified, its request counted per address (before any lookup, so a flood of
 * guesses costs nothing), the `Authorization: Bearer` token verified, the request counted per token,
 * the scopes checked. Expected refusals are values, for `apiTokenErrorResponse`; a failed count or
 * lookup is logged and answered `mcp-access.api_unavailable`. A scope the app does not declare, or a
 * missing bucket, is a setup bug and throws.
 */
export async function requireApiToken(
  ctx: McpAccessContext,
  request: Request,
  { scopes: required }: RequireApiTokenOptions,
): Promise<Ok<ApiTokenIdentity> | ApiTokenRefusal> {
  const apiOptions = getApiTokenOptions(ctx);
  if (apiOptions === null) {
    throw new Error("@softure-ai/mcp-access: requireApiToken needs apiTokens in mcpAccess({ ... })");
  }
  assertDeclaredScopes(apiOptions, required);
  assertRateLimitBuckets(ctx);

  const client = identifyClient(ctx, request.headers);
  if (!client.ok) return client;
  try {
    const byAddress = await consumeRateLimit(ctx, { bucket: API_RATE_LIMIT_BUCKET, key: client.value });
    if (!byAddress.ok) return { ...err("security.rate_limited"), retryAfterSeconds: byAddress.retryAfterSeconds };

    const header = request.headers.get("authorization");
    if (header === null || !BEARER_PREFIX.test(header)) return err("mcp-access.api_token_missing");
    const checked = await checkApiToken(ctx, header.replace(BEARER_PREFIX, "").trim());
    if (checked === null) return err("mcp-access.api_token_invalid");
    const { verified, withheld } = checked;

    const byToken = await consumeRateLimit(ctx, { bucket: API_TOKEN_RATE_LIMIT_BUCKET, key: subjectKey(verified.tokenId) });
    if (!byToken.ok) return { ...err("security.rate_limited"), retryAfterSeconds: byToken.retryAfterSeconds };

    const missingScopes = required.filter((scope) => !verified.scopes.includes(scope));
    if (missingScopes.length > 0) {
      // Write scopes the token holds while writing is off: say so, the token itself is fine.
      const code = missingScopes.every((scope) => withheld.includes(scope)) ? "mcp-access.api_writes_disabled" : "mcp-access.api_scope_missing";
      return { ...err(code), missingScopes };
    }
    return ok({ userId: verified.userId, tokenId: verified.tokenId, scopes: verified.scopes });
  } catch (error) {
    // The token is never logged; the operation and the failure label are.
    console.error(`@softure-ai/mcp-access: checking an API token failed: ${errorLogLabel(error)}`);
    return err("mcp-access.api_unavailable");
  }
}

const STATUS_BY_CODE: Readonly<Record<ApiTokenRefusal["error"], number>> = {
  "security.client_unidentified": 400,
  "mcp-access.api_token_missing": 401,
  "mcp-access.api_token_invalid": 401,
  "mcp-access.api_scope_missing": 403,
  "mcp-access.api_writes_disabled": 403,
  "security.rate_limited": 429,
  "mcp-access.api_unavailable": 503,
};

/**
 * The HTTP answer to a refusal of `requireApiToken`: JSON `{ error }` (the code without its module), with
 * `WWW-Authenticate` on 401 and 403 (RFC 6750 §3), `Retry-After` on 429, and never cached.
 */
export function apiTokenErrorResponse(refusal: ApiTokenRefusal): Response {
  const status = STATUS_BY_CODE[refusal.error];
  const error = refusal.error.slice(refusal.error.indexOf(".") + 1);
  const headers = new Headers({ "cache-control": NO_STORE });
  if (status === 401) {
    headers.set("www-authenticate", refusal.error === "mcp-access.api_token_missing" ? "Bearer" : 'Bearer error="invalid_token"');
  }
  if ("missingScopes" in refusal) {
    headers.set("www-authenticate", `Bearer error="insufficient_scope", scope="${refusal.missingScopes.join(" ")}"`);
    return Response.json({ error, missingScopes: refusal.missingScopes }, { status, headers });
  }
  if ("retryAfterSeconds" in refusal) headers.set("retry-after", String(refusal.retryAfterSeconds));
  return Response.json({ error }, { status, headers });
}

function assertDeclaredScopes(apiOptions: ApiTokenOptions, required: readonly string[]): void {
  const declared = new Set(apiOptions.scopes.map((scope) => scope.name));
  const unknown = required.filter((scope) => !declared.has(scope));
  if (unknown.length > 0) {
    throw new Error(`@softure-ai/mcp-access: requireApiToken asks for scopes apiTokens.scopes does not declare: ${unknown.join(", ")}`);
  }
}

/** A missing bucket is a setup bug: thrown, so it reaches the log by name instead of a quiet 503. */
function assertRateLimitBuckets(ctx: McpAccessContext): void {
  const options = getModule(ctx.config, "security")?.options as { buckets?: Record<string, unknown> } | undefined;
  for (const bucket of [API_RATE_LIMIT_BUCKET, API_TOKEN_RATE_LIMIT_BUCKET]) {
    if (options?.buckets?.[bucket] === undefined) {
      throw new Error(`@softure-ai/mcp-access: the security module has no "${bucket}" bucket; spread API_TOKEN_RATE_LIMIT_BUCKETS into security({ buckets })`);
    }
  }
}
