// The routes the module mounts, as constants for code that cannot read the config: a proxy matcher,
// a client, a test. The manifest declares the same object.

export const DEFAULT_MCP_ACCESS_ROUTES = {
  /** The token page. */
  page: "/account/mcp",
  /** `POST` MCP endpoint. */
  endpoint: "/api/mcp",
  /** OAuth consent page, the authorization endpoint. */
  oauthConsent: "/oauth/authorize",
  /** `POST` target of the consent form. */
  oauthDecision: "/api/oauth/authorize",
  /** `POST` OAuth token endpoint. */
  oauthToken: "/api/oauth/token",
  /** `POST` dynamic client registration. */
  oauthRegister: "/api/oauth/register",
} as const;

/**
 * The headers the consent page answers with: no other site may frame it, so none can trick a click
 * on "Allow" (clickjacking). A page cannot set response headers in Next, so the app adds them in
 * `next.config` (`buildOAuthConsentHeaders`) or its proxy.
 */
export const OAUTH_CONSENT_PAGE_HEADERS: readonly { readonly key: string; readonly value: string }[] = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

/** A `headers()` entry of `next.config` for the consent page: `headers: () => Promise.resolve([buildOAuthConsentHeaders()])`. */
export function buildOAuthConsentHeaders(consentPath: string = DEFAULT_MCP_ACCESS_ROUTES.oauthConsent): {
  source: string;
  headers: { key: string; value: string }[];
} {
  return { source: consentPath, headers: OAUTH_CONSENT_PAGE_HEADERS.map((header) => ({ ...header })) };
}
