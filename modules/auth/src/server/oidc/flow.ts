// OpenID Connect sign-in: the authorization code flow with PKCE S256 (RFC 7636), a one-time state and a nonce.
// `startOidcSignIn` stores the sign-in (the state's sha256, the nonce, the verifier, the return path) and answers
// the provider's authorize URL and the state, which the adapter keeps in a short-lived cookie: the callback must come
// back to the browser that started it (no login CSRF). `completeOidcSignIn` consumes the row, exchanges the code,
// verifies the ID token, checks the allowlist and opens a session. Nothing the provider says is echoed: failures
// are codes, and the reason behind `auth.oidc_failed` goes to the log only.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit } from "@softure-ai/security/server";
import { and, eq, gt, lte } from "drizzle-orm";
import type { OidcSignInErrorCode, SignedIn } from "../../contract.js";
import type { OidcProvider } from "../../options.js";
import { toSafeNextPath } from "../../safe-next-path.js";
import { oidcStates } from "../../schema.js";
import { getAuthOptions, getAuthRoutes } from "../options.js";
import { assertAuthBuckets, BUCKETS } from "../rate-limits.js";
import { createSession, deleteExpiredSessions } from "../sessions.js";
import { resolveOidcAccount } from "./accounts.js";
import { findOidcProvider, getOidcRedirectUri, readOidcClient, type OidcContext } from "./context.js";
import { findSigningKey, getProviderMetadata } from "./discovery.js";
import { checkIdTokenClaims, decodeIdToken, isSignedBy, type IdentityClaims } from "./id-token.js";
import { exchangeCode } from "./token-request.js";

const RANDOM_BYTES = 32;
const MAX_STATE_LENGTH = 512;
const MAX_CODE_LENGTH = 4096;
const REQUIRED_SCOPES = ["openid", "email"];

export interface StartOidcSignInInput {
  readonly provider: string;
  /** Where to go after the sign-in; checked like login's `next`. */
  readonly next?: string;
  /** The client's rate limit key (`identifyClient`). */
  readonly clientKey: string;
}

export interface StartedOidcSignIn {
  /** The provider's authorize URL to send the browser to. */
  readonly url: string;
  /** The state, for the browser's cookie; the callback must bring the same one back. */
  readonly state: string;
  /** How long the sign-in may take, for the cookie's `Max-Age`. */
  readonly maxAgeSeconds: number;
}

export type StartOidcSignInResult = Ok<StartedOidcSignIn> | Err<"auth.oidc_failed"> | RateLimitRejection;

/** Starts a sign-in with `provider`. Database errors propagate. */
export async function startOidcSignIn(ctx: OidcContext, input: StartOidcSignInInput): Promise<StartOidcSignInResult> {
  assertAuthBuckets(ctx.config);
  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.oidcStart, key: input.clientKey });
  if (!limit.ok) return limit;
  const provider = findOidcProvider(ctx.config, input.provider);
  if (provider === undefined) return err("auth.oidc_failed");
  const client = readOidcClient(ctx, provider);
  if (!client.ok) return fail(provider, client.reason);
  const metadata = await getProviderMetadata(ctx, provider);
  if (!metadata.ok) return fail(provider, metadata.reason);

  const now = ctx.clock.now();
  const ttlMinutes = getAuthOptions(ctx.config).oidc.stateTtlMinutes;
  const state = createRandomValue();
  const nonce = createRandomValue();
  const codeVerifier = createRandomValue();
  await ctx.db.delete(oidcStates).where(lte(oidcStates.expiresAt, now));
  await ctx.db.insert(oidcStates).values({
    stateHash: hashState(state),
    provider: provider.id,
    nonce,
    codeVerifier,
    nextPath: toSafeNextPath(input.next, getAuthRoutes(ctx.config).afterLogin),
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
  });

  const url = new URL(metadata.value.authorizationEndpoint);
  for (const [name, value] of Object.entries(provider.authorizeParams)) url.searchParams.set(name, value);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client.value.clientId);
  url.searchParams.set("redirect_uri", getOidcRedirectUri(ctx.config, provider.id));
  url.searchParams.set("scope", [...new Set([...REQUIRED_SCOPES, ...provider.scopes])].join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", createHash("sha256").update(codeVerifier, "ascii").digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  return ok({ url: url.toString(), state, maxAgeSeconds: ttlMinutes * 60 });
}

/** The callback's query: `code` and `state`, or `error` and `state`. */
export interface OidcCallbackParams {
  readonly state: string | null;
  readonly code: string | null;
  readonly error: string | null;
}

export interface CompleteOidcSignInInput {
  /** The provider in the callback's path. */
  readonly provider: string;
  readonly params: OidcCallbackParams;
  /** The state from the browser's cookie; null without the cookie. */
  readonly browserState: string | null;
  readonly clientKey: string;
}

export type CompleteOidcSignInResult = Ok<SignedIn & { readonly next: string }> | Err<OidcSignInErrorCode> | RateLimitRejection;

/** Completes the sign-in the callback names and opens a session. Database errors and a failing hook propagate. */
export async function completeOidcSignIn(ctx: OidcContext, input: CompleteOidcSignInInput): Promise<CompleteOidcSignInResult> {
  assertAuthBuckets(ctx.config);
  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.oidcCallback, key: input.clientKey });
  if (!limit.ok) return limit;
  const provider = findOidcProvider(ctx.config, input.provider);
  if (provider === undefined) return err("auth.oidc_failed");

  const { state, code, error } = input.params;
  if (state === null || state.length > MAX_STATE_LENGTH) return fail(provider, "state missing");
  if (input.browserState === null || !isSameText(state, input.browserState)) return fail(provider, "state not from this browser");
  const now = ctx.clock.now();
  // One-time: the row is gone whatever happens next.
  const [pending] = await ctx.db
    .delete(oidcStates)
    .where(and(eq(oidcStates.stateHash, hashState(state)), eq(oidcStates.provider, provider.id), gt(oidcStates.expiresAt, now)))
    .returning();
  if (pending === undefined) return fail(provider, "state unknown, used or expired");
  if (error !== null) return error === "access_denied" ? err("auth.oidc_cancelled") : fail(provider, "provider answered an error");
  if (code === null || code === "" || code.length > MAX_CODE_LENGTH) return fail(provider, "code missing");

  const client = readOidcClient(ctx, provider);
  if (!client.ok) return fail(provider, client.reason);
  const metadata = await getProviderMetadata(ctx, provider);
  if (!metadata.ok) return fail(provider, metadata.reason);
  const exchanged = await exchangeCode(ctx, {
    provider,
    client: client.value,
    tokenEndpoint: metadata.value.tokenEndpoint,
    code,
    codeVerifier: pending.codeVerifier,
    redirectUri: getOidcRedirectUri(ctx.config, provider.id),
  });
  if (!exchanged.ok) return fail(provider, exchanged.reason);

  const token = decodeIdToken(exchanged.value);
  if (!token.ok) return fail(provider, token.reason);
  const key = await findSigningKey(ctx, metadata.value, { kid: token.value.kid, keyType: token.value.keyType });
  if (!key.ok) return fail(provider, key.reason);
  if (!isSignedBy(token.value, key.value)) return fail(provider, "id_token signature");
  const claims = checkIdTokenClaims(token.value.payload, { issuer: provider.issuer, clientId: client.value.clientId, nonce: pending.nonce, now });
  if (!claims.ok) return fail(provider, claims.reason);

  const email = getAllowedEmail(provider, claims.value);
  if (email === null) return err("auth.oidc_not_allowed");
  const account = await resolveOidcAccount(ctx, provider, { subject: claims.value.subject, email });
  if (!account.ok) return account;

  await deleteExpiredSessions(ctx, account.value.id);
  const session = await createSession(ctx, account.value.id);
  return ok({ user: account.value, session, next: toSafeNextPath(pending.nextPath, getAuthRoutes(ctx.config).afterLogin) });
}

/**
 * The identity's email when it may sign in: verified, and listed in `allowedEmails` or of a domain in
 * `allowedDomains` (with `requireHostedDomain`, the `hd` claim must name that domain too); null otherwise.
 */
export function getAllowedEmail(provider: OidcProvider, claims: IdentityClaims): string | null {
  const { email } = claims;
  if (email === null || !claims.isEmailVerified) return null;
  if (provider.allowedEmails.includes(email)) return email;
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const domain = email.slice(at + 1);
  if (!provider.allowedDomains.includes(domain)) return null;
  if (provider.requireHostedDomain && claims.hostedDomain !== domain) return null;
  return email;
}

function fail(provider: OidcProvider, reason: string): Err<"auth.oidc_failed"> {
  // The reason is this module's own wording: never a value from the provider or the browser.
  console.warn(`@softure-ai/auth: OpenID Connect sign-in with ${provider.id} failed: ${reason}`);
  return err("auth.oidc_failed");
}

function createRandomValue(): string {
  return randomBytes(RANDOM_BYTES).toString("base64url");
}

/** The stored form of a state: sha256 hex. */
function hashState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

function isSameText(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
