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
