import { getSessionCookie } from "@softure-ai/auth";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

describe("getSessionCookie", () => {
  it("is a host-only __Host- cookie on an https origin", () => {
    expect(getSessionCookie(createConfig({ appOrigin: "https://app.example.com" }))).toEqual({
      name: "__Host-softure_session",
      domain: undefined,
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAgeSeconds: 30 * 24 * 60 * 60,
    });
  });

  it("becomes a __Secure- cookie when shared with subdomains", () => {
    const cookie = getSessionCookie(createConfig({ appOrigin: "https://example.com", auth: { cookie: { domain: "example.com" } } }));
    expect(cookie).toMatchObject({ name: "__Secure-softure_session", domain: "example.com", secure: true });
  });

  it("keeps the bare name on plain HTTP, where browsers refuse prefixed cookies", () => {
    expect(getSessionCookie(createConfig({ appOrigin: "http://localhost:3000" }))).toMatchObject({ name: "softure_session", secure: false });
  });

  it("follows an explicit secure flag, the cookie name and the TTL", () => {
    const cookie = getSessionCookie(
      createConfig({ appOrigin: "http://localhost:3000", auth: { cookie: { name: "sid", secure: true }, session: { ttlDays: 7 } } }),
    );
    expect(cookie).toMatchObject({ name: "__Host-sid", secure: true, maxAgeSeconds: 7 * 24 * 60 * 60 });
  });
});
