// Web Bot Auth for verify: an RFC 9421 signature on a route's request, the profile `@softure-ai/agent-ready` signs
// an app's own requests with (draft-meunier-webbotauth-httpsig-protocol-00). Its own copy on `node:crypto`: deploy
// cannot depend on agent-ready, which has deploy as a devDependency. The tests check it with the reference library.
import { createPrivateKey, createPublicKey, hash, randomBytes, sign, type KeyObject } from "node:crypto";

/** The variable agent-ready reads the seed from by default: the Ed25519 seed as base64url (the JWK `d`). */
export const DEFAULT_WEB_BOT_AUTH_KEY_ENV = "WEB_BOT_AUTH_PRIVATE_KEY";

/** The validity of a request signature: the receiver gets it at once; five minutes cover clock skew. */
const SIGNATURE_TTL_SECONDS = 300;
const TAG = "web-bot-auth";
const LABEL = "sig1";
/** The DER header of an Ed25519 private key in PKCS #8 (RFC 8410); the 32-byte seed follows it. */
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SEED_BYTES = 32;
const NONCE_BYTES = 64;

/** Where variables come from: `process.env`, or a plain object in tests. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface WebBotAuthKey {
  readonly privateKey: KeyObject;
  readonly publicJwk: { readonly kty: "OKP"; readonly crv: "Ed25519"; readonly x: string };
  /** The JWK thumbprint (RFC 7638): `keyid` in the signature. */
  readonly keyid: string;
}

export type ReadWebBotAuthKey = { ok: true; key: WebBotAuthKey } | { ok: false; reason: string };

/** The signing key from the variable `name`; a failure names the variable, never its value. */
export function readWebBotAuthKey(env: EnvSource, name: string): ReadWebBotAuthKey {
  const seed = env[name]?.trim();
  if (seed === undefined || seed === "") return { ok: false, reason: `${name} is not set` };
  const bytes = /^[A-Za-z0-9_-]+={0,2}$/.test(seed) ? Buffer.from(seed, "base64url") : null;
  if (bytes?.length !== SEED_BYTES) return { ok: false, reason: `${name} is not a base64url Ed25519 seed (32 bytes)` };
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, bytes]), format: "der", type: "pkcs8" });
  const { x } = createPublicKey(privateKey).export({ format: "jwk" });
  // Node exports an Ed25519 public key as an OKP JWK, which always has `x`.
  const publicJwk = { kty: "OKP", crv: "Ed25519", x: String(x) } as const;
  // A digest of the public key, not of a secret: the thumbprint is the key's public name.
  const keyid = hash("sha256", JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x }), "base64url");
  return { ok: true, key: { privateKey, publicJwk, keyid } };
}

export interface WebBotAuthSignOptions {
  readonly key: WebBotAuthKey;
  /** The origin whose key directory holds the key: `Signature-Agent`. */
  readonly agentOrigin: string;
  /** The signing time; default now. */
  readonly now?: Date;
  /** The single-use value; default 64 random bytes. */
  readonly nonce?: string;
}

/**
 * The headers that sign a request to `url`: `signature-agent`, `signature-input` and `signature`, covering the
 * request's `@authority` and the `signature-agent` member.
 */
export function getWebBotAuthHeaders(url: string, options: WebBotAuthSignOptions): Record<string, string> {
  const agent = `"${new URL(options.agentOrigin).origin}"`;
  const components = ['"@authority"', `"signature-agent";key="${LABEL}"`] as const;
  const created = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const nonce = options.nonce ?? randomBytes(NONCE_BYTES).toString("base64");
  const params =
    `(${components.join(" ")})` +
    `;created=${created}` +
    `;keyid="${options.key.keyid}"` +
    `;alg="ed25519"` +
    `;expires=${created + SIGNATURE_TTL_SECONDS}` +
    `;nonce="${nonce}"` +
    `;tag="${TAG}"`;
  // The signature base (RFC 9421 §2.5): a line per component, then `@signature-params`, no trailing newline.
  const base = [`${components[0]}: ${new URL(url).host.toLowerCase()}`, `${components[1]}: ${agent}`, `"@signature-params": ${params}`].join("\n");
  const signature = sign(null, Buffer.from(base, "utf8"), options.key.privateKey).toString("base64");
  return {
    "signature-agent": `${LABEL}=${agent}`,
    "signature-input": `${LABEL}=${params}`,
    signature: `${LABEL}=:${signature}:`,
  };
}
