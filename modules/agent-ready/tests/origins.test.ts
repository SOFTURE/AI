// The origins a request is served under: from the proxy's headers, never from the listening address.
import { createOrigins, readRequestOrigin, resolveOrigins, trimOrigin } from "@softure-ai/agent-ready";
import { describe, expect, it } from "vitest";
import { createRequest } from "./support.js";

describe("origins", () => {
  it("reads the host and the scheme a proxy forwarded, not the listening address", () => {
    expect(readRequestOrigin(createRequest("/x", "example.com"))).toBe("https://example.com");
  });

  it("takes the first X-Forwarded-Proto value and ignores one that is not http or https", () => {
    expect(readRequestOrigin(createRequest("/x", "example.com", "https, http"))).toBe("https://example.com");
    expect(readRequestOrigin(createRequest("/x", "example.com", "gopher"))).toBe("http://example.com");
  });

  it("falls back to the URL when Host is missing", () => {
    expect(readRequestOrigin(new Request("https://example.com:8443/x"))).toBe("https://example.com:8443");
  });

  it("uses configured origins first, then the request", () => {
    const request = createRequest("/", "example.com");
    expect(resolveOrigins(request)).toEqual({ appOrigin: "https://example.com", apexOrigin: "https://example.com", requestOrigin: "https://example.com" });
    expect(resolveOrigins(request, { appOrigin: "https://app.example.com/" })).toEqual({
      appOrigin: "https://app.example.com",
      apexOrigin: "https://app.example.com",
      requestOrigin: "https://example.com",
    });
    expect(resolveOrigins(request, { appOrigin: "https://app.example.com", apexOrigin: "https://example.com" }).apexOrigin).toBe("https://example.com");
  });

  it("treats an empty configured origin as unset", () => {
    expect(resolveOrigins(createRequest("/", "example.com"), { appOrigin: " " }).appOrigin).toBe("https://example.com");
  });

  it("trims trailing slashes and builds origins outside a request", () => {
    expect(trimOrigin("https://example.com//")).toBe("https://example.com");
    expect(createOrigins("https://app.example.com/", "https://example.com")).toEqual({
      appOrigin: "https://app.example.com",
      apexOrigin: "https://example.com",
      requestOrigin: "https://app.example.com",
    });
  });
});
