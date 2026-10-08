// Web Bot Auth: an RFC 9421 signature on the requests an app sends to other servers, and the key directory a receiver
// checks it with (draft-meunier-webbotauth-httpsig-protocol-00 and the directory draft). Ed25519, `node:crypto` only.
//
// A missing key is not an error: without it requests go out unsigned and the directory answers 404. A signature is an
// extra on a request; it never stops one.
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify, type KeyObject } from "node:crypto";

export const WEB_BOT_AUTH_DIRECTORY_CONTENT_TYPE = "application/http-message-signatures-directory+json";

/** The default variables: the Ed25519 seed (base64url JWK `d`) and the retired public keys (`x`, comma-separated). */
export const DEFAULT_PRIVATE_KEY_ENV = "WEB_BOT_AUTH_PRIVATE_KEY";
export const DEFAULT_RETIRED_KEYS_ENV = "WEB_BOT_AUTH_RETIRED_PUBLIC_KEYS";

/** A request signature's validity: the receiver gets it at once; five minutes cover clock skew. */
export const REQUEST_SIGNATURE_TTL_SECONDS = 300;
/** The directory signature's validity: the route's `max-age`. */
export const DIRECTORY_SIGNATURE_TTL_SECONDS = 3600;

const REQUEST_TAG = "web-bot-auth";
const DIRECTORY_TAG = "http-message-signatures-directory";
const REQUEST_LABEL = "sig1";
const DIRECTORY_LABEL = "binding0";

/** The DER header of an Ed25519 private key in PKCS #8 (RFC 8410); the 32-byte seed follows it. */
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const ED25519_KEY_BYTES = 32;
const NONCE_BYTES = 64;

/** Where variables come from: `process.env`, or a plain object in tests. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface Ed25519PublicJwk {
  readonly kty: "OKP";
  readonly crv: "Ed25519";
  readonly x: string;
}

export interface WebBotAuthKey {
  readonly privateKey: KeyObject;
  readonly publicJwk: Ed25519PublicJwk;
  /** The JWK thumbprint (RFC 7638): `keyid` in a signature. */
  readonly keyid: string;
}

export interface WebBotAuthEnvNames {
  readonly privateKeyEnv?: string;
  readonly retiredKeysEnv?: string;
}

export interface SignatureClock {
  /** The signing time; default now. */
  readonly now?: Date;
  /** The single-use value; default 64 random bytes. */
  readonly nonce?: string;
}

function decodeKeyBytes(value: string): Buffer | null {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(trimmed)) return null;
  const bytes = Buffer.from(trimmed, "base64url");
  return bytes.length === ED25519_KEY_BYTES ? bytes : null;
}

/** The JWK thumbprint (RFC 7638): SHA-256 of the canonical JSON of the required members, base64url. */
export function getJwkThumbprint(jwk: Ed25519PublicJwk): string {
  return createHash("sha256").update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x })).digest("base64url");
}

/** The key of a seed, or null when the seed is not 32 bytes of base64url. */
export function createWebBotAuthKey(seed: string): WebBotAuthKey | null {
  const bytes = decodeKeyBytes(seed);
  if (bytes === null) return null;
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, bytes]), format: "der", type: "pkcs8" });
  const exported = createPublicKey(privateKey).export({ format: "jwk" });
  if (typeof exported.x !== "string") return null;
  const publicJwk: Ed25519PublicJwk = { kty: "OKP", crv: "Ed25519", x: exported.x };
  return { privateKey, publicJwk, keyid: getJwkThumbprint(publicJwk) };
}

/**
 * The signing key from the environment. Unset: null, silently (the normal state). Malformed: null and one log line
 * naming the variable, never its value.
 */
export function readWebBotAuthKey(env: EnvSource = process.env, names: WebBotAuthEnvNames = {}): WebBotAuthKey | null {
  const name = names.privateKeyEnv ?? DEFAULT_PRIVATE_KEY_ENV;
  const seed = env[name];
  if (seed === undefined || seed === "") return null;
  const key = createWebBotAuthKey(seed);
  if (key === null) console.error(`@softure-ai/agent-ready: ${name} is not a base64url Ed25519 seed (32 bytes); requests go unsigned`);
  return key;
}

/** The retired public keys; an entry that is not an Ed25519 key is skipped with a log line naming the variable. */
export function readRetiredPublicKeys(env: EnvSource = process.env, names: WebBotAuthEnvNames = {}): Ed25519PublicJwk[] {
  const name = names.retiredKeysEnv ?? DEFAULT_RETIRED_KEYS_ENV;
  const raw = env[name];
  if (raw === undefined || raw === "") return [];
  const keys: Ed25519PublicJwk[] = [];
  for (const entry of raw.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (decodeKeyBytes(entry) === null) {
      console.error(`@softure-ai/agent-ready: an entry of ${name} is not a base64url Ed25519 public key; skipped`);
      continue;
    }
    keys.push({ kty: "OKP", crv: "Ed25519", x: entry });
  }
  return keys;
}

/** `@authority` (RFC 9421 §2.2.3): the host in lower case, the port only when not the default. */
export function getAuthority(url: string): string {
  return new URL(url).host.toLowerCase();
}

function createNonce(): string {
  return randomBytes(NONCE_BYTES).toString("base64");
}

interface SignatureParameters {
  readonly created: number;
  readonly expires: number;
  readonly keyid: string;
  readonly nonce: string;
  readonly tag: string;
}

/** `@signature-params`: the same text goes into `Signature-Input` and into the last line of the signature base. */
function serializeSignatureParams(components: readonly string[], params: SignatureParameters): string {
  return (
    `(${components.join(" ")})` +
    `;created=${params.created}` +
    `;keyid="${params.keyid}"` +
    `;alg="ed25519"` +
    `;expires=${params.expires}` +
    `;nonce="${params.nonce}"` +
    `;tag="${params.tag}"`
  );
}

/** The signature base (RFC 9421 §2.5): a line per component, then `@signature-params`, no trailing newline. */
function buildSignatureBase(lines: ReadonlyArray<readonly [string, string]>, signatureParams: string): string {
  return [...lines.map(([id, value]) => `${id}: ${value}`), `"@signature-params": ${signatureParams}`].join("\n");
}

function signBase(key: WebBotAuthKey, base: string): string {
  return sign(null, Buffer.from(base, "utf8"), key.privateKey).toString("base64");
}

function getTimes(now: Date, ttlSeconds: number): { created: number; expires: number } {
  const created = Math.floor(now.getTime() / 1000);
  return { created, expires: created + ttlSeconds };
}

export interface RequestSignatureOptions extends SignatureClock {
  readonly key: WebBotAuthKey;
  /** The origin whose directory holds the key (the apex). */
  readonly agentOrigin: string;
}

/** The headers that sign a request to `url`: `Signature-Agent`, `Signature-Input` and `Signature`. */
export function getRequestSignatureHeaders(url: string, options: RequestSignatureOptions): Record<string, string> {
  const agent = `"${new URL(options.agentOrigin).origin}"`;
  const components = ['"@authority"', `"signature-agent";key="${REQUEST_LABEL}"`] as const;
  const params = serializeSignatureParams(components, {
    ...getTimes(options.now ?? new Date(), REQUEST_SIGNATURE_TTL_SECONDS),
    keyid: options.key.keyid,
    nonce: options.nonce ?? createNonce(),
    tag: REQUEST_TAG,
  });
  const base = buildSignatureBase(
    [
      [components[0], getAuthority(url)],
      [components[1], agent],
    ],
    params,
  );
  return {
    "Signature-Agent": `${REQUEST_LABEL}=${agent}`,
    "Signature-Input": `${REQUEST_LABEL}=${params}`,
    Signature: `${REQUEST_LABEL}=:${signBase(options.key, base)}:`,
  };
}

function describeAuthority(url: string): string {
  try {
    return getAuthority(url);
  } catch {
    return "an unparsable URL";
  }
}

export interface OutgoingSignatureOptions extends WebBotAuthEnvNames {
  /** The origin whose directory holds the key (the apex). */
  readonly agentOrigin: string;
  readonly env?: EnvSource;
}

/**
 * Headers for an outgoing request, the key from the environment: none without a key, and none (with a log line)
 * when signing throws. An unsigned request is better than no request.
 */
export function signOutgoingRequest(url: string, options: OutgoingSignatureOptions): Record<string, string> {
  const key = readWebBotAuthKey(options.env ?? process.env, options);
  if (key === null) return {};
  try {
    return getRequestSignatureHeaders(url, { key, agentOrigin: options.agentOrigin });
  } catch (error) {
    console.error(`@softure-ai/agent-ready: signing a request to ${describeAuthority(url)} failed:`, error instanceof Error ? error.message : String(error));
    return {};
  }
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * `fetch` that signs every request when a key is set. It never throws for the signature: any failure sends the
 * request unsigned. Pass it to code that takes a `fetch`, e.g. seo's IndexNow submit.
 */
export function createSignedFetch(fetchImpl: FetchLike, options: OutgoingSignatureOptions): FetchLike {
  return (input, init) => {
    let headers: Record<string, string>;
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      headers = signOutgoingRequest(url, options);
    } catch {
      headers = {};
    }
    if (Object.keys(headers).length === 0) return fetchImpl(input, init);
    const merged = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    for (const [name, value] of Object.entries(headers)) merged.set(name, value);
    return fetchImpl(input, { ...init, headers: merged });
  };
}

/** The directory body: a JWKS with the signing key and the retired ones, each once. */
export function buildSignatureDirectory(key: WebBotAuthKey, retired: readonly Ed25519PublicJwk[] = []): { keys: Ed25519PublicJwk[] } {
  const keys = [key.publicJwk];
  for (const jwk of retired) {
    if (!keys.some((existing) => existing.x === jwk.x)) keys.push(jwk);
  }
  return { keys };
}

/**
 * The signature of the directory response: component `"@authority";req` (the host the verifier fetched it from) and
 * tag `http-message-signatures-directory`, proof that the key's owner controls that origin.
 */
export function getDirectorySignatureHeaders(authority: string, options: SignatureClock & { readonly key: WebBotAuthKey }): Record<string, string> {
  const component = '"@authority";req';
  const params = serializeSignatureParams([component], {
    ...getTimes(options.now ?? new Date(), DIRECTORY_SIGNATURE_TTL_SECONDS),
    keyid: options.key.keyid,
    nonce: options.nonce ?? createNonce(),
    tag: DIRECTORY_TAG,
  });
  const base = buildSignatureBase([[component, authority.toLowerCase()]], params);
  return {
    "Signature-Input": `${DIRECTORY_LABEL}=${params}`,
    Signature: `${DIRECTORY_LABEL}=:${signBase(options.key, base)}:`,
  };
}

export interface DirectoryVerificationInput {
  /** The host the directory was fetched from. */
  readonly authority: string;
  /** The response's `Signature-Input` and `Signature` headers. */
  readonly signatureInput: string | null;
  readonly signature: string | null;
  /** The parsed response body. */
  readonly body: unknown;
  readonly now?: Date;
}

export interface DirectoryVerification {
  readonly ok: boolean;
  readonly detail: string;
}

/** Splits a structured-field dictionary (`a=…, b=…`) into its members by label. */
function splitDictionary(header: string): Map<string, string> {
  const members = new Map<string, string>();
  for (const member of header.split(/,\s*(?=[a-z*][a-z0-9_.*-]*=)/)) {
    const at = member.indexOf("=");
    if (at > 0) members.set(member.slice(0, at).trim(), member.slice(at + 1).trim());
  }
  return members;
}

function readParam(params: string, name: string): string | null {
  const match = new RegExp(`;${name}=("([^"]*)"|(\\d+))`).exec(params);
  return match === null ? null : (match[2] ?? match[3] ?? null);
}

function readDirectoryKeys(body: unknown): Ed25519PublicJwk[] {
  const keys = (body as { keys?: unknown } | null)?.keys;
  if (!Array.isArray(keys)) return [];
  return keys.filter(
    (key): key is Ed25519PublicJwk =>
      typeof key === "object" && key !== null && (key as Ed25519PublicJwk).kty === "OKP" && (key as Ed25519PublicJwk).crv === "Ed25519" && typeof (key as Ed25519PublicJwk).x === "string",
  );
}

/**
 * Checks a directory response the way a verifier does: a signature with component `"@authority";req` and tag
 * `http-message-signatures-directory`, inside its validity, made by a key the directory lists. Any one valid
 * signature is enough.
 */
export function verifyDirectorySignature(input: DirectoryVerificationInput): DirectoryVerification {
  if (input.signatureInput === null || input.signature === null) return { ok: false, detail: "no Signature-Input or Signature header" };
  const keys = readDirectoryKeys(input.body);
  if (keys.length === 0) return { ok: false, detail: "the directory lists no Ed25519 key" };
  const signatures = splitDictionary(input.signature);
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const problems: string[] = [];
  for (const [label, params] of splitDictionary(input.signatureInput)) {
    if (!params.startsWith('("@authority";req)')) {
      problems.push(`${label}: covers ${params.split(";")[0] ?? "nothing"}, not ("@authority";req)`);
      continue;
    }
    if (readParam(params, "tag") !== DIRECTORY_TAG) {
      problems.push(`${label}: tag is not ${DIRECTORY_TAG}`);
      continue;
    }
    const created = Number(readParam(params, "created"));
    const expires = Number(readParam(params, "expires"));
    if (!Number.isFinite(created) || !Number.isFinite(expires) || now > expires || now + 60 < created) {
      problems.push(`${label}: outside its validity (created ${created}, expires ${expires})`);
      continue;
    }
    const keyid = readParam(params, "keyid");
    const key = keys.find((jwk) => getJwkThumbprint(jwk) === keyid);
    const value = /^:([A-Za-z0-9+/=]+):$/.exec(signatures.get(label) ?? "")?.[1];
    if (key === undefined || value === undefined) {
      problems.push(`${label}: ${key === undefined ? `keyid ${keyid ?? "-"} is not in the directory` : "no signature value"}`);
      continue;
    }
    const base = buildSignatureBase([['"@authority";req', input.authority.toLowerCase()]], params);
    const publicKey = createPublicKey({ key: { kty: key.kty, crv: key.crv, x: key.x }, format: "jwk" });
    if (verify(null, Buffer.from(base, "utf8"), publicKey, Buffer.from(value, "base64"))) {
      return { ok: true, detail: `${label}: signed by ${keyid ?? "-"} for ${input.authority.toLowerCase()}` };
    }
    problems.push(`${label}: the signature does not verify for ${input.authority.toLowerCase()}`);
  }
  return { ok: false, detail: problems.join("; ") || "no signature" };
}
