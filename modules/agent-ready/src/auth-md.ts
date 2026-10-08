// `/auth.md` (WorkOS auth.md): how an agent gets a token for one person's MCP access. Built from the authorization
// server metadata the token issuer serves, so every endpoint it names is the one the server answers on.
import { getMcpEndpointUrl, getServiceDocUrl, type AgentDocumentContext } from "./context.js";
import { getResourceMetadataUrl } from "./oauth.js";
import { AUTHORIZATION_SERVER_METADATA_PATH } from "./paths.js";

export const AUTH_MD_CONTENT_TYPE = "text/markdown; charset=utf-8";

/** The authorization server metadata (RFC 8414) as auth.md reads it. */
export type AuthorizationServerMetadata = Readonly<Record<string, unknown>>;

function readString(metadata: AuthorizationServerMetadata, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function readList(metadata: AuthorizationServerMetadata, key: string): string[] {
  const value = metadata[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function code(value: string): string {
  return `\`${value}\``;
}

/** Every URL-valued key of the metadata (`*_endpoint`, `*_uri`, `issuer`), for the endpoint list. */
export function listMetadataUrls(metadata: AuthorizationServerMetadata): Array<{ key: string; url: string }> {
  return Object.keys(metadata)
    .filter((key) => key === "issuer" || key.endsWith("_endpoint") || key.endsWith("_uri"))
    .flatMap((key) => {
      const url = readString(metadata, key);
      return url !== null && URL.canParse(url) ? [{ key, url }] : [];
    });
}

/**
 * The auth.md document. The H1 contains `auth.md` (the scanner looks for it). It states only what the server does:
 * PKCE S256, rotating refresh tokens, the configured lifetimes; agentic registration without the person is named as
 * unsupported. Every URL-valued key of the metadata is listed under "Endpoints", so the two cannot drift.
 */
export function buildAuthMd(context: AgentDocumentContext, metadata: AuthorizationServerMetadata): string {
  const { options, origins } = context;
  const { read, write } = options.scopes;
  const issuer = readString(metadata, "issuer") ?? origins.appOrigin;
  const resource = getMcpEndpointUrl(context);
  const prm = getResourceMetadataUrl(origins.appOrigin, options.mcp.path);
  const registration = readString(metadata, "registration_endpoint");
  const authorization = readString(metadata, "authorization_endpoint") ?? "the authorization_endpoint";
  const token = readString(metadata, "token_endpoint") ?? "the token_endpoint";
  const revocation = readString(metadata, "revocation_endpoint");
  const lifetimes = options.oauth?.lifetimes;
  const manualTokenPage = options.oauth?.manualTokenPath === undefined ? null : `${origins.appOrigin}${options.oauth.manualTokenPath}`;
  const clientAuthMethods = readList(metadata, "token_endpoint_auth_methods_supported").map(code).join(", ");
  const challengeMethods = readList(metadata, "code_challenge_methods_supported");
  const endpoints = listMetadataUrls(metadata)
    .map(({ key, url }) => `- ${code(key)}: ${code(url)}`)
    .join("\n");

  const methods = [
    "- **OAuth (recommended)**: for any client that can open a browser for the person: " +
      (registration === null ? "" : "dynamic client registration, ") +
      "authorization code with PKCE, a consent screen. Below.",
    ...(manualTokenPage === null
      ? []
      : [
          `- **Manual token**: the person creates a token at ${code(manualTokenPage)} and pastes it into your configuration. ` +
            'Send it as `Authorization: Bearer <token>`; skip to "Use the access token".',
        ]),
    "- Agentic registration without the person (identity assertions, verified email, anonymous registration, a claim ceremony) is **not supported**.",
  ];

  const register =
    registration === null
      ? "This server has no dynamic client registration: use a client the person has registered for you."
      : `${code(`POST ${registration}`)} (RFC 7591), a JSON body with ${code("client_name")}, ${code("redirect_uris")}` +
        (clientAuthMethods === "" ? "" : ` and optionally ${code("token_endpoint_auth_method")} (${clientAuthMethods})`) +
        ". Redirect URIs must be `https`, `http` on loopback only, or a native-app scheme (RFC 8252); they are matched exactly. " +
        `The response (${code("201")}) holds your ${code("client_id")} (and ${code("client_secret")} for a confidential client).`;

  return `# auth.md: ${options.title}

You are an agent acting for **one person who has an account with ${options.title}**. This file tells you how to get an access token for that person's MCP server. There is no access without the person: they sign in and approve your client themselves.

- Resource (MCP, Streamable HTTP): ${code(resource)}
- Authorization server (OAuth 2.1, no OpenID Connect): ${code(issuer)}

## Discover

1. Call the resource without a token. The ${code("401")} carries ${code(`WWW-Authenticate: Bearer resource_metadata="${prm}"`)}.
2. Fetch that protected resource metadata (RFC 9728). ${code("authorization_servers[0]")} is ${code(issuer)}.
3. Fetch ${code(`${issuer}${AUTHORIZATION_SERVER_METADATA_PATH}`)} (RFC 8414) and use the endpoints from it, not from this file, if they ever differ.

## Endpoints

${endpoints}

## Pick a method

${methods.join("\n")}

## Register

${register}

## Authorize

Send the person's browser to ${code(authorization)} with ${code("response_type=code")}, ${code("client_id")}, ${code("redirect_uri")}, ${code("state")}, ${code("code_challenge")} and ${code("code_challenge_method=S256")} (PKCE is required${challengeMethods.includes("plain") ? "" : "; `plain` is rejected"}), ${code(`resource=${resource}`)} and ${code("scope")}:

- ${code(read)}: read the account's data. Always granted.
- ${code(write)}: also change it. Granted only if you ask for it **and** the person approves it on the consent screen.

The person signs in if needed and sees which client asks for what. On approval you get ${code("code")}, ${code("state")} and ${code("iss")} on your redirect URI; check ${code("state")} and that ${code("iss")} is ${code(issuer)}. The code is single-use${lifetimes === undefined ? "" : ` and expires after ${lifetimes.authorizationCodeMinutes} minutes`}.

## Exchange

${code(`POST ${token}`)} (form-encoded) with ${code("grant_type=authorization_code")}, ${code("code")}, ${code("redirect_uri")}, ${code("client_id")} and ${code("code_verifier")} (plus client authentication if you registered a secret). The response has ${code("access_token")} (${code("token_type")} Bearer, ${code("expires_in")}${lifetimes === undefined ? "" : `: ${lifetimes.accessTokenMinutes * 60}`}), ${code("refresh_token")} and ${code("scope")}.

## Use the access token

Send ${code("Authorization: Bearer <access_token>")} on every request to ${code(resource)}; never put a token in a URL. Write tools are listed only when the token carries ${code(write)} **and** writes are enabled for this service; otherwise ${code("tools/list")} has no write tools.

Refresh with ${code("grant_type=refresh_token")} at the same token endpoint. Refresh tokens rotate: every refresh returns a new one and the old one stops working; presenting a replaced refresh token again revokes the whole grant.${lifetimes === undefined ? "" : ` A refresh token lives ${lifetimes.refreshTokenDays} days.`}

## Errors

- ${code("401")} from the resource: the token is missing, expired or revoked. Refresh once, otherwise start again from "Authorize".
- ${code("invalid_grant")} from the token endpoint: the code or refresh token is spent, expired or revoked. Start again from "Authorize".
- ${code("invalid_client")}: wrong client credentials. Register again.
- ${code("invalid_target")}: ${code("resource")} is not ${code(resource)}. Send exactly that value.
- ${code("invalid_redirect_uri")}, ${code("invalid_client_metadata")}: fix the registration request.
- ${code("access_denied")} on your redirect URI: the person declined. Do not retry on your own.
- ${code("429")}: too many attempts from your address. Wait and retry later.

## Revocation

${
  revocation === null
    ? `The person sees every connected client${manualTokenPage === null ? "" : ` and manual token at ${code(manualTokenPage)}`} and can revoke them at any time; revoking a client ends its access and refresh tokens at once. There is no token revocation endpoint for clients.`
    : `Revoke a token at ${code(revocation)} (RFC 7009). The person can also revoke your client at any time.`
} Keep tokens out of logs, URLs and shared storage. More for people: ${getServiceDocUrl(context)}
`;
}
