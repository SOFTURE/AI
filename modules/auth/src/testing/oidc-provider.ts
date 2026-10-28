// An in-memory OpenID Connect provider for tests: discovery, JWKS, authorize (`signIn`) and the token endpoint, reached
// through a `fetch` the app's `auth({ oidc: { fetch } })` takes. It checks what a real provider checks (client
// credentials, redirect URI, PKCE verifier, one-time codes) and signs real ID tokens (RS256 or ES256), so the module's
// verification runs for real. A test breaks it on purpose: other claims, another key, `alg: none`, key rotation, an
// outage, an endpoint on plain http.
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";
import { systemClock, type Clock, type FetchFunction } from "@softure-ai/core";
import type { OpenIdConnectProviderInput } from "../options.js";

export interface FakeOidcProviderOptions {
  /** The provider id. Default `fake`. */
  readonly id?: string;
  /** Default `https://fake-oidc.test`. */
  readonly issuer?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly clientAuth?: "body" | "basic";
  /** Default RS256. */
  readonly algorithm?: "RS256" | "ES256";
  /** The clock the tokens' `iat` and `exp` come from; pass the module context's test clock. */
  readonly clock?: Clock;
  /** The allowlist of the definition. Default `allowedDomains: ["example.com"]`. */
  readonly allowedDomains?: readonly string[];
  readonly allowedEmails?: readonly string[];
  readonly requireHostedDomain?: boolean;
  readonly createAccounts?: boolean;
}

/** The person at the provider's sign-in screen. */
export interface FakeOidcUser {
  readonly subject: string;
  readonly email: string;
  /** Default true. */
  readonly emailVerified?: boolean;
  /** Google's Workspace domain claim. */
  readonly hostedDomain?: string;
  /** The `name` claim (sent with the `profile` scope). */
  readonly name?: string;
  /** The `given_name` claim. */
  readonly givenName?: string;
}

export interface FakeSignInOptions {
  /** The person refuses consent: the callback carries `error=access_denied`. */
  readonly deny?: boolean;
  /** Claims that replace or add to the ID token's own (`aud`, `nonce`, `exp`, …); `undefined` removes one. */
  readonly claims?: Readonly<Record<string, unknown>>;
  /** Signs with a key outside the JWKS, or sends an unsigned token (`alg: none`). */
  readonly signWith?: "unknown-key" | "none";
}

/** A failure the next calls to the provider answer with, in order. */
export type FakeOidcFailure = "unavailable" | "invalid_grant" | "no_id_token";

export interface FakeOidcProvider {
  /** The provider entry for `auth({ oidc: { providers: [fake.definition] } })`. */
  readonly definition: OpenIdConnectProviderInput;
  /** The environment the definition reads its client id and secret from. */
  readonly env: Readonly<Record<string, string>>;
  /** The `fetch` for `auth({ oidc: { fetch } })`. */
  readonly fetch: FetchFunction;
  /** Checks the authorize URL as a provider does and answers the callback URL it redirects the browser to. */
  signIn(authorizeUrl: string, user: FakeOidcUser, options?: FakeSignInOptions): URL;
  /** A new signing key replaces the current one in the JWKS (the provider rotated its keys). */
  rotateKeys(): void;
  /** The next calls to the token endpoint fail like this, one per entry. */
  failNext(...failures: FakeOidcFailure[]): void;
  /** Overrides fields of the discovery document (`{ token_endpoint: "http://…" }`). */
  setDiscovery(overrides: Readonly<Record<string, unknown>>): void;
  /** What the provider saw. */
  readonly calls: { readonly discovery: number; readonly jwks: number; readonly token: number; readonly lastForm: URLSearchParams | null };
}

interface PendingCode {
  readonly redirectUri: string;
  readonly challenge: string;
  readonly nonce: string | null;
  readonly user: FakeOidcUser;
  readonly options: FakeSignInOptions;
}

interface SigningKeyPair {
  readonly kid: string;
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;
}

const random = () => randomBytes(24).toString("base64url");
const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

export function createFakeOidcProvider(options: FakeOidcProviderOptions = {}): FakeOidcProvider {
  const id = options.id ?? "fake";
  const issuer = options.issuer ?? "https://fake-oidc.test";
  const clientId = options.clientId ?? "fake-client";
  const clientSecret = options.clientSecret ?? "fake-client-secret";
  const algorithm = options.algorithm ?? "RS256";
  const clock = options.clock ?? systemClock;
  const envPrefix = `${id.toUpperCase().replaceAll("-", "_")}_OIDC`;
  const urls = { discovery: `${issuer}/.well-known/openid-configuration`, jwks: `${issuer}/jwks`, token: `${issuer}/token`, authorize: `${issuer}/authorize` };

  const createKey = (): SigningKeyPair => {
    const pair = algorithm === "RS256" ? generateKeyPairSync("rsa", { modulusLength: 2048 }) : generateKeyPairSync("ec", { namedCurve: "P-256" });
    return { kid: random(), ...pair };
  };
  let key = createKey();
  const strangerKey = createKey();
  const codes = new Map<string, PendingCode>();
  const failures: FakeOidcFailure[] = [];
  let discoveryOverrides: Readonly<Record<string, unknown>> = {};
  const calls = { discovery: 0, jwks: 0, token: 0, lastForm: null as URLSearchParams | null };

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  function signToken(claims: Record<string, unknown>, signWith: FakeSignInOptions["signWith"]): string {
    if (signWith === "none") return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.`;
    const signer = signWith === "unknown-key" ? strangerKey : key;
    const input = `${encode({ alg: algorithm, typ: "JWT", kid: signer.kid })}.${encode(claims)}`;
    const signature =
      algorithm === "RS256"
        ? sign("sha256", Buffer.from(input), signer.privateKey)
        : sign("sha256", Buffer.from(input), { key: signer.privateKey, dsaEncoding: "ieee-p1363" });
    return `${input}.${signature.toString("base64url")}`;
  }

  function buildClaims(pending: PendingCode): Record<string, unknown> {
    const now = Math.floor(clock.now().getTime() / 1000);
    const claims: Record<string, unknown> = {
      iss: issuer,
      sub: pending.user.subject,
      aud: clientId,
      iat: now,
      exp: now + 3600,
      email: pending.user.email,
      email_verified: pending.user.emailVerified ?? true,
    };
    if (pending.nonce !== null) claims.nonce = pending.nonce;
    if (pending.user.hostedDomain !== undefined) claims.hd = pending.user.hostedDomain;
    if (pending.user.name !== undefined) claims.name = pending.user.name;
    if (pending.user.givenName !== undefined) claims.given_name = pending.user.givenName;
    for (const [name, value] of Object.entries(pending.options.claims ?? {})) {
      if (value === undefined) delete claims[name];
      else claims[name] = value;
    }
    return claims;
  }

  function readClient(form: URLSearchParams, authorization: string | null): { id: string | null; secret: string | null } {
    if (authorization?.startsWith("Basic ") === true) {
      const [user, password] = Buffer.from(authorization.slice(6), "base64").toString("utf8").split(":");
      return { id: user === undefined ? null : decodeURIComponent(user), secret: password === undefined ? null : decodeURIComponent(password) };
    }
    return { id: form.get("client_id"), secret: form.get("client_secret") };
  }

  function answerToken(init: RequestInit): Response {
    calls.token += 1;
    const form = new URLSearchParams(init.body instanceof URLSearchParams ? init.body : typeof init.body === "string" ? init.body : "");
    calls.lastForm = form;
    const failure = failures.shift();
    if (failure === "unavailable") return json(503, { error: "temporarily_unavailable" });
    if (failure === "invalid_grant") return json(400, { error: "invalid_grant" });
    const client = readClient(form, new Headers(init.headers).get("authorization"));
    if (client.id !== clientId || client.secret !== clientSecret) return json(401, { error: "invalid_client" });
    if (form.get("grant_type") !== "authorization_code") return json(400, { error: "unsupported_grant_type" });
    const code = form.get("code") ?? "";
    const pending = codes.get(code);
    codes.delete(code);
    if (pending === undefined || form.get("redirect_uri") !== pending.redirectUri) return json(400, { error: "invalid_grant" });
    const verifier = form.get("code_verifier") ?? "";
    if (createHash("sha256").update(verifier, "ascii").digest("base64url") !== pending.challenge) return json(400, { error: "invalid_grant" });
    if (failure === "no_id_token") return json(200, { access_token: random(), token_type: "Bearer" });
    return json(200, {
      access_token: random(),
      token_type: "Bearer",
      expires_in: 3600,
      id_token: signToken(buildClaims(pending), pending.options.signWith),
    });
  }

  const fetchFake: FetchFunction = (input, init) => Promise.resolve(route(input, init));

  function route(input: string | URL, init: RequestInit): Response {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const target = `${url.origin}${url.pathname}`;
    if (target === urls.discovery) {
      calls.discovery += 1;
      return json(200, {
        issuer,
        authorization_endpoint: urls.authorize,
        token_endpoint: urls.token,
        jwks_uri: urls.jwks,
        response_types_supported: ["code"],
        id_token_signing_alg_values_supported: [algorithm],
        ...discoveryOverrides,
      });
    }
    if (target === urls.jwks) {
      calls.jwks += 1;
      return json(200, { keys: [{ ...key.publicKey.export({ format: "jwk" }), kid: key.kid, use: "sig", alg: algorithm }] });
    }
    if (target === urls.token && init.method === "POST") return answerToken(init);
    return json(404, { error: "not_found" });
  }

  return {
    definition: {
      id,
      name: "Fake",
      issuer,
      clientIdEnv: `${envPrefix}_CLIENT_ID`,
      clientSecretEnv: `${envPrefix}_CLIENT_SECRET`,
      clientAuth: options.clientAuth ?? "body",
      allowedDomains: [...(options.allowedDomains ?? (options.allowedEmails === undefined ? ["example.com"] : []))],
      allowedEmails: [...(options.allowedEmails ?? [])],
      requireHostedDomain: options.requireHostedDomain,
      createAccounts: options.createAccounts,
    },
    env: { [`${envPrefix}_CLIENT_ID`]: clientId, [`${envPrefix}_CLIENT_SECRET`]: clientSecret },
    fetch: fetchFake,
    signIn(authorizeUrl, user, signInOptions = {}) {
      const url = new URL(authorizeUrl);
      const query = url.searchParams;
      if (`${url.origin}${url.pathname}` !== urls.authorize) throw new Error(`fake OIDC provider: authorize URL ${url.origin}${url.pathname} is not ${urls.authorize}`);
      if (query.get("client_id") !== clientId) throw new Error("fake OIDC provider: unknown client_id");
      if (query.get("response_type") !== "code") throw new Error("fake OIDC provider: response_type must be code");
      if (!(query.get("scope") ?? "").split(" ").includes("openid")) throw new Error("fake OIDC provider: scope lacks openid");
      if (query.get("code_challenge_method") !== "S256") throw new Error("fake OIDC provider: PKCE S256 is required");
      const redirectUri = query.get("redirect_uri");
      const state = query.get("state");
      const challenge = query.get("code_challenge");
      if (redirectUri === null || state === null || challenge === null) throw new Error("fake OIDC provider: redirect_uri, state and code_challenge are required");
      const callback = new URL(redirectUri);
      callback.searchParams.set("state", state);
      if (signInOptions.deny === true) {
        callback.searchParams.set("error", "access_denied");
        return callback;
      }
      const code = random();
      codes.set(code, { redirectUri, challenge, nonce: query.get("nonce"), user, options: signInOptions });
      callback.searchParams.set("code", code);
      return callback;
    },
    rotateKeys() {
      key = createKey();
    },
    failNext(...next) {
      failures.push(...next);
    },
    setDiscovery(overrides) {
      discoveryOverrides = overrides;
    },
    calls,
  };
}
