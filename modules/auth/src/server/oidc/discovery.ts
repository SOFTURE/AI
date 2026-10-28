// A provider's discovery document (OpenID Connect Discovery 1.0) and its signing keys (JWKS), fetched through
// core's `requestJson` (timeout, no redirect followed) and cached per app configuration. The document must name the
// configured issuer (§4.3) and https endpoints, so a document cannot send the client secret to another scheme.
import { createPublicKey, type JsonWebKey, type KeyObject } from "node:crypto";
import { requestJson, type SoftureConfig } from "@softure-ai/core";
import { z } from "zod";
import { isSecureEndpoint, type OpenIdProvider } from "../../options.js";
import { getAuthOptions } from "../options.js";
import { passed, refused, type Checked, type OidcContext } from "./context.js";

/** How long a discovery document is reused. */
const METADATA_TTL_MS = 60 * 60 * 1000;
/** How long a key set is reused, and the shortest gap between two fetches for an unknown key id. */
const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_REFETCH_FLOOR_MS = 60 * 1000;

const endpoint = z.string().max(2048).refine(isSecureEndpoint);

const metadataSchema = z.object({
  issuer: z.string().max(2048),
  authorization_endpoint: endpoint,
  token_endpoint: endpoint,
  jwks_uri: endpoint,
});

const jwkSchema = z.looseObject({
  kty: z.string(),
  kid: z.string().max(256).optional(),
  use: z.string().optional(),
  alg: z.string().optional(),
});

const jwksSchema = z.object({ keys: z.array(jwkSchema).max(100) });

export interface ProviderMetadata {
  readonly issuer: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksUri: string;
}

export interface SigningKey {
  readonly kid: string | undefined;
  readonly key: KeyObject;
}

interface Cached<T> {
  readonly value: T;
  readonly fetchedAt: number;
}

const metadataCache = new WeakMap<SoftureConfig, Map<string, Cached<ProviderMetadata>>>();
const jwksCache = new WeakMap<SoftureConfig, Map<string, Cached<readonly SigningKey[]>>>();

function getCache<T>(caches: WeakMap<SoftureConfig, Map<string, Cached<T>>>, config: SoftureConfig): Map<string, Cached<T>> {
  let cache = caches.get(config);
  if (cache === undefined) {
    cache = new Map();
    caches.set(config, cache);
  }
  return cache;
}

function requestOptions(ctx: OidcContext) {
  const options = getAuthOptions(ctx.config).oidc;
  return { fetch: options.fetch, timeoutMs: options.httpTimeoutMs, clock: ctx.clock };
}

/** The provider's endpoints, or the reason (for the log) they could not be read. */
export async function getProviderMetadata(ctx: OidcContext, provider: OpenIdProvider): Promise<Checked<ProviderMetadata>> {
  const cache = getCache(metadataCache, ctx.config);
  const now = ctx.clock.now().getTime();
  const cached = cache.get(provider.issuer);
  if (cached !== undefined && now - cached.fetchedAt < METADATA_TTL_MS) return passed(cached.value);

  const answer = await requestJson({
    url: `${provider.issuer}/.well-known/openid-configuration`,
    schema: metadataSchema,
    ...requestOptions(ctx),
  });
  if (!answer.ok) return refused(`discovery ${answer.error}`);
  if (answer.value.issuer.replace(/\/+$/, "") !== provider.issuer) return refused("discovery issuer_mismatch");
  const metadata: ProviderMetadata = {
    issuer: answer.value.issuer,
    authorizationEndpoint: answer.value.authorization_endpoint,
    tokenEndpoint: answer.value.token_endpoint,
    jwksUri: answer.value.jwks_uri,
  };
  cache.set(provider.issuer, { value: metadata, fetchedAt: now });
  return passed(metadata);
}

/**
 * The key that signed a token: by `kid`, or the only signing key of the type when the token names none. An unknown
 * `kid` (the provider rotated its keys) refetches the set, at most once a minute.
 */
export async function findSigningKey(
  ctx: OidcContext,
  metadata: ProviderMetadata,
  match: { readonly kid: string | undefined; readonly keyType: "RSA" | "EC" },
): Promise<Checked<KeyObject>> {
  const cache = getCache(jwksCache, ctx.config);
  const now = ctx.clock.now().getTime();
  const cached = cache.get(metadata.jwksUri);
  if (cached !== undefined && now - cached.fetchedAt < JWKS_TTL_MS) {
    const key = pickKey(cached.value, match);
    if (key !== undefined) return passed(key);
    if (now - cached.fetchedAt < JWKS_REFETCH_FLOOR_MS) return refused("jwks unknown_key");
  }
  const answer = await requestJson({ url: metadata.jwksUri, schema: jwksSchema, ...requestOptions(ctx) });
  if (!answer.ok) return refused(`jwks ${answer.error}`);
  const keys = answer.value.keys.flatMap((jwk) => toSigningKey(jwk));
  cache.set(metadata.jwksUri, { value: keys, fetchedAt: now });
  const key = pickKey(keys, match);
  return key === undefined ? refused("jwks unknown_key") : passed(key);
}

function toSigningKey(jwk: z.output<typeof jwkSchema>): SigningKey[] {
  if (jwk.use !== undefined && jwk.use !== "sig") return [];
  try {
    return [{ kid: jwk.kid, key: createPublicKey({ key: jwk as JsonWebKey, format: "jwk" }) }];
  } catch {
    // A key node cannot read (another curve, a broken entry) cannot have signed a token we accept.
    return [];
  }
}

function pickKey(keys: readonly SigningKey[], match: { readonly kid: string | undefined; readonly keyType: "RSA" | "EC" }): KeyObject | undefined {
  const nodeType = match.keyType === "RSA" ? "rsa" : "ec";
  const ofType = keys.filter((entry) => entry.key.asymmetricKeyType === nodeType);
  if (match.kid !== undefined) return ofType.find((entry) => entry.kid === match.kid)?.key;
  return ofType.length === 1 ? ofType[0]?.key : undefined;
}
