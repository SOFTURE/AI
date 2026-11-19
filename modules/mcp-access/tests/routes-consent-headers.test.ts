// The consent page's anti-framing headers, as a next.config `headers()` entry.
import { buildOAuthConsentHeaders, DEFAULT_MCP_ACCESS_ROUTES } from "@softure-ai/mcp-access";
import { describe, expect, it } from "vitest";

describe("buildOAuthConsentHeaders", () => {
  it("forbids framing the default consent path", () => {
    expect(buildOAuthConsentHeaders()).toEqual({
      source: DEFAULT_MCP_ACCESS_ROUTES.oauthConsent,
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    });
  });

  it("takes a moved consent path", () => {
    expect(buildOAuthConsentHeaders("/connect/authorize").source).toBe("/connect/authorize");
  });
});
