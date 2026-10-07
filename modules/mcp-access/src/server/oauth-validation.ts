// The OAuth boundary: registration metadata, redirect URIs, scopes and `resource`. Everything
// enters as `unknown` or a raw string and leaves as a result; an expected refusal is a value.
import { z } from "zod";
import type { OAuthTokenEndpointAuthMethod } from "../schema.js";
import type { OAuthClientRegistration } from "./oauth.js";

/** The longest client name: it is also the name of the client's access tokens (1-60). */
export const MAX_CLIENT_NAME_LENGTH = 60;

/**
 * Schemes never accepted as a redirect URI: they run code or read local resources in the person's
 * browser, or travel unencrypted. Other non-HTTP schemes are native app schemes (RFC 8252 §7.1,
 * e.g. `cursor://`, `vscode://`), which desktop MCP clients return through.
 */
const FORBIDDEN_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:", "about:", "ws:", "wss:", "ftp:"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const AUTH_METHODS = ["none", "client_secret_post", "client_secret_basic"] as const satisfies readonly OAuthTokenEndpointAuthMethod[];

/**
 * Whether a URI may be a `redirect_uri`: `https` anywhere, `http` only on loopback (RFC 8252
 * §7.3), a native app scheme outside the deny list; never with a fragment (RFC 6749 §3.1.2).
 */
export function isAllowedRedirectUri(candidate: string): boolean {
  if (candidate.includes("#")) return false;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return url.hostname !== "";
  if (url.protocol === "http:") return LOOPBACK_HOSTS.has(url.hostname);
  return !FORBIDDEN_SCHEMES.has(url.protocol);
}

/** A name without control or format characters, trimmed and cut: it is shown on the consent page. */
function cleanClientName(name: string): string {
  return name
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim()
    .slice(0, MAX_CLIENT_NAME_LENGTH)
    .trim();
}

const registrationSchema = z.object({
  redirect_uris: z.array(z.string().max(2000)).min(1).max(10),
  client_name: z.string().max(200).optional(),
  token_endpoint_auth_method: z.enum(AUTH_METHODS).optional(),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(),
  response_types: z.array(z.literal("code")).optional(),
});

export interface RegistrationError {
  readonly error: "invalid_redirect_uri" | "invalid_client_metadata";
  readonly description: string;
}

/**
 * Registration metadata (RFC 7591 §2). The default method is `client_secret_basic`, as the RFC
 * says; MCP clients name `none` themselves. Without a name the client is called after the host of
 * its first redirect URI, so the consent page has something to say.
 */
export type ClientRegistrationResult =
  | { readonly ok: true; readonly value: OAuthClientRegistration }
  | { readonly ok: false; readonly error: RegistrationError };

export function parseClientRegistration(body: unknown): ClientRegistrationResult {
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    const isRedirectIssue = parsed.error.issues.some((issue) => issue.path[0] === "redirect_uris");
    return {
      ok: false,
      error: isRedirectIssue
        ? { error: "invalid_redirect_uri", description: "redirect_uris must list 1 to 10 URIs." }
        : { error: "invalid_client_metadata", description: `Invalid client metadata: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}.` },
    };
  }
  const redirectUris = parsed.data.redirect_uris;
  if (!redirectUris.every(isAllowedRedirectUri)) {
    return {
      ok: false,
      error: {
        error: "invalid_redirect_uri",
        description: "A redirect URI must be https, http on a loopback host or a native app scheme, without a fragment.",
      },
    };
  }
  const name = cleanClientName(parsed.data.client_name ?? "");
  // The first URI parsed above; a native scheme without a host falls back to its scheme.
  const firstUri = new URL(redirectUris[0] ?? "");
  const fallbackName = cleanClientName(firstUri.host === "" ? firstUri.protocol.replace(/:$/, "") : firstUri.host);
  return {
    ok: true,
    value: {
      clientName: name !== "" ? name : fallbackName,
      redirectUris,
      tokenEndpointAuthMethod: parsed.data.token_endpoint_auth_method ?? "client_secret_basic",
    },
  };
}

/** The URL a native client returns to, as it may be shown: the host for http(s), else the whole URI. */
export function describeRedirectUri(redirectUri: string): string {
  const url = new URL(redirectUri);
  return url.protocol === "https:" || url.protocol === "http:" ? url.host : redirectUri;
}
