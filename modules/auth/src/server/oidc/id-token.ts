// The ID token (OpenID Connect Core §3.1.3.7): a JWS in compact form, signed with RS256 or ES256 (no `none`, no
// HMAC), checked against the issuer's key and the claims the sign-in expects. Nothing in the token is trusted before
// its signature is.
import { timingSafeEqual, verify, type KeyObject } from "node:crypto";
import { z } from "zod";
import { passed, refused, type Checked } from "./context.js";

/** Clock skew tolerated between this server and the provider. */
const SKEW_SECONDS = 60;
const MAX_TOKEN_LENGTH = 16_384;
/** The longest display name kept, in characters (code points); `auth.users.display_name` checks the same bound. */
export const MAX_DISPLAY_NAME_LENGTH = 200;
const SEGMENT = /^[A-Za-z0-9_-]+$/;

const ALGORITHMS = { RS256: "RSA", ES256: "EC" } as const;
export type IdTokenAlgorithm = keyof typeof ALGORITHMS;

const headerSchema = z.object({ alg: z.string(), kid: z.string().max(256).optional() });

const claimsSchema = z.object({
  iss: z.string(),
  sub: z.string().min(1).max(255),
  aud: z.union([z.string(), z.array(z.string()).min(1).max(20)]),
  azp: z.string().optional(),
  exp: z.number(),
  iat: z.number(),
  nonce: z.string().optional(),
  email: z.string().max(254).optional(),
  // Most providers send a boolean; some send the string.
  email_verified: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).optional(),
  hd: z.string().max(253).optional(),
  // Profile claims are best effort: a malformed one is dropped, never a reason to refuse the sign-in.
  name: z.unknown().optional(),
  given_name: z.unknown().optional(),
});

export interface DecodedIdToken {
  readonly algorithm: IdTokenAlgorithm;
  readonly keyType: "RSA" | "EC";
  readonly kid: string | undefined;
  readonly signingInput: string;
  readonly signature: Buffer;
  readonly payload: unknown;
}

/** The token's parts, or the reason (for the log) it is not a JWS this module accepts. */
export function decodeIdToken(token: string): Checked<DecodedIdToken> {
  if (token.length > MAX_TOKEN_LENGTH) return refused("id_token too_long");
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((part) => SEGMENT.test(part))) return refused("id_token malformed");
  const [encodedHeader = "", encodedPayload = "", encodedSignature = ""] = parts;
  const header = headerSchema.safeParse(parseJson(encodedHeader));
  if (!header.success) return refused("id_token malformed");
  const algorithm = header.data.alg;
  if (!Object.hasOwn(ALGORITHMS, algorithm)) return refused("id_token algorithm");
  const payload = parseJson(encodedPayload);
  if (payload === undefined) return refused("id_token malformed");
  return passed({
    algorithm: algorithm as IdTokenAlgorithm,
    keyType: ALGORITHMS[algorithm as IdTokenAlgorithm],
    kid: header.data.kid,
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature: Buffer.from(encodedSignature, "base64url"),
    payload,
  });
}

function parseJson(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
}

/** Whether `key` signed the token. An ES256 signature is the JWS form (r || s), not DER. */
export function isSignedBy(token: DecodedIdToken, key: KeyObject): boolean {
  const data = Buffer.from(token.signingInput, "ascii");
  try {
    if (token.algorithm === "ES256") {
      return key.asymmetricKeyDetails?.namedCurve === "prime256v1" && verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, token.signature);
    }
    return verify("sha256", data, key, token.signature);
  } catch {
    return false;
  }
}

export interface ExpectedClaims {
  readonly issuer: string;
  readonly clientId: string;
  readonly nonce: string;
  readonly now: Date;
}

/** What a valid token says about the person. */
export interface IdentityClaims {
  readonly subject: string;
  readonly email: string | null;
  readonly isEmailVerified: boolean;
  readonly hostedDomain: string | null;
  /** `name`, else `given_name`, normalized; null when the token carries neither. */
  readonly displayName: string | null;
}

/** The identity, or the reason (for the log) the claims do not fit this sign-in. */
export function checkIdTokenClaims(payload: unknown, expected: ExpectedClaims): Checked<IdentityClaims> {
  const parsed = claimsSchema.safeParse(payload);
  if (!parsed.success) return refused("id_token claims");
  const claims = parsed.data;
  const nowSeconds = expected.now.getTime() / 1000;
  if (claims.iss.replace(/\/+$/, "") !== expected.issuer) return refused("id_token issuer");
  const audiences = typeof claims.aud === "string" ? [claims.aud] : claims.aud;
  if (!audiences.includes(expected.clientId)) return refused("id_token audience");
  if ((audiences.length > 1 || claims.azp !== undefined) && claims.azp !== expected.clientId) return refused("id_token azp");
  if (claims.exp <= nowSeconds - SKEW_SECONDS) return refused("id_token expired");
  if (claims.iat > nowSeconds + SKEW_SECONDS) return refused("id_token issued_in_future");
  if (claims.nonce === undefined || !isSameText(claims.nonce, expected.nonce)) return refused("id_token nonce");
  return passed({
    subject: claims.sub,
    email: claims.email === undefined ? null : claims.email.trim().toLowerCase(),
    isEmailVerified: claims.email_verified === true,
    hostedDomain: claims.hd === undefined ? null : claims.hd.trim().toLowerCase(),
    displayName: toDisplayName(claims.name) ?? toDisplayName(claims.given_name),
  });
}

/**
 * A profile claim as a display name: NFC, control and format characters dropped, whitespace collapsed, trimmed, at
 * most `MAX_DISPLAY_NAME_LENGTH` characters. Null for anything but a string with visible text.
 */
export function toDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim();
  const name = [...cleaned].slice(0, MAX_DISPLAY_NAME_LENGTH).join("").trimEnd();
  return name === "" ? null : name;
}

function isSameText(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
