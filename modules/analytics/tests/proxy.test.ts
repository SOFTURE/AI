// The proxy piece: puts the channel back on navigations from tagged pages and carries it through
// redirects other pieces answer with. It never sets a cookie.
import { createChannelTagger } from "@softure-ai/analytics/proxy";
import { describe, expect, it } from "vitest";
import { APP_ORIGIN, createConfig, createRequest } from "./support.js";

const TAGGED_HOME = `${APP_ORIGIN}/?z=newsletter`;

describe("createChannelTagger", () => {
  it("refuses to start when the analytics module is not enabled", () => {
    expect(() => createChannelTagger({ ...createConfig(), modules: [] })).toThrow("@softure-ai/analytics: the module is not enabled");
  });
});

describe("tag", () => {
  const channels = createChannelTagger(createConfig());

  it("redirects a navigation from a tagged page to the same URL with the channel", () => {
    const response = channels.tag(createRequest("/register?step=1", { referer: TAGGED_HOME }));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/register?step=1&z=newsletter`);
    expect(response?.headers.get("set-cookie")).toBeNull();
  });

  it("redirects a Next.js client navigation (RSC) the same way", () => {
    const response = channels.tag(createRequest("/register?_rsc=abc", { referer: TAGGED_HOME, rsc: true }));
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/register?_rsc=abc&z=newsletter`);
  });

  it("redirects a Next.js client navigation whose RSC header Next stripped, recognised by Next-Url", () => {
    const response = channels.tag(createRequest("/register", { referer: TAGGED_HOME, nextUrl: "/", destination: "empty" }));
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/register?z=newsletter`);
    expect(channels.tag(createRequest("/register", { referer: TAGGED_HOME, nextUrl: "/" }))?.status).toBe(307);
  });

  it("leaves a subresource alone even with a Next-Url header", () => {
    expect(channels.tag(createRequest("/logo.png", { referer: TAGGED_HOME, nextUrl: "/", destination: "image" }))).toBeNull();
  });

  it("builds the target on appOrigin, not on an internal request host", () => {
    const request = new Request("http://10.0.0.5:3000/register", { headers: { referer: "http://10.0.0.5:3000/?z=ads", "sec-fetch-mode": "navigate" } });
    expect(channels.tag(request)?.headers.get("location")).toBe(`${APP_ORIGIN}/register?z=ads`);
  });

  it("never leaves the app for a path that looks like another host", () => {
    const request = new Request(`${APP_ORIGIN}//elsewhere.example.com/x`, { headers: { referer: TAGGED_HOME, "sec-fetch-mode": "navigate" } });
    expect(new URL(request.url).pathname).toBe("//elsewhere.example.com/x");
    expect(channels.tag(request)?.headers.get("location")).toBe(`${APP_ORIGIN}//elsewhere.example.com/x?z=newsletter`);
  });

  it("lets a request with its own parameter through, valid or not, so it can never loop", () => {
    expect(channels.tag(createRequest("/register?z=newsletter", { referer: TAGGED_HOME }))).toBeNull();
    expect(channels.tag(createRequest("/register?z=Bad", { referer: TAGGED_HOME }))).toBeNull();
  });

  it("lets through requests that come from no tagged same-origin page", () => {
    expect(channels.tag(createRequest("/register"))).toBeNull();
    expect(channels.tag(createRequest("/register", { referer: `${APP_ORIGIN}/about` }))).toBeNull();
    expect(channels.tag(createRequest("/register", { referer: `${APP_ORIGIN}/?z=Not-Valid` }))).toBeNull();
    expect(channels.tag(createRequest("/register", { referer: "https://evil.example.com/?z=newsletter" }))).toBeNull();
  });

  it("leaves fetches, images, beacons and server actions alone", () => {
    expect(channels.tag(createRequest("/api/data", { referer: TAGGED_HOME, navigate: false }))).toBeNull();
    expect(channels.tag(createRequest("/register", { referer: TAGGED_HOME, method: "POST" }))).toBeNull();
  });

  it("redirects a HEAD navigation like a GET", () => {
    expect(channels.tag(createRequest("/register", { referer: TAGGED_HOME, method: "HEAD" }))?.status).toBe(307);
  });

  it("uses the parameter the app configured", () => {
    const custom = createChannelTagger(createConfig({ channel: { param: "ref" } }));
    expect(custom.tag(createRequest("/register", { referer: `${APP_ORIGIN}/?ref=ads` }))?.headers.get("location")).toBe(`${APP_ORIGIN}/register?ref=ads`);
    expect(custom.tag(createRequest("/register", { referer: TAGGED_HOME }))).toBeNull();
  });
});

describe("carry", () => {
  const channels = createChannelTagger(createConfig());
  const loginRedirect = () => Response.redirect(`${APP_ORIGIN}/login?next=%2Faccount`, 307);

  it("adds the request's own channel to a same-origin redirect", () => {
    const response = channels.carry(createRequest("/account?z=ads"), loginRedirect());
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/login?next=%2Faccount&z=ads`);
  });

  it("adds the channel of the tagged page the request came from", () => {
    const response = channels.carry(createRequest("/account", { referer: TAGGED_HOME }), loginRedirect());
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/login?next=%2Faccount&z=newsletter`);
  });

  it("resolves a relative Location against the request and keeps the other headers", () => {
    const redirect = new Response(null, { status: 302, headers: { location: "/login", "cache-control": "no-store" } });
    const response = channels.carry(createRequest("/account?z=ads"), redirect);
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/login?z=ads`);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });

  it("returns null for null, so the chain goes on to tag", () => {
    expect(channels.carry(createRequest("/?z=ads"), null)).toBeNull();
    expect(channels.carry(createRequest("/?z=ads"), undefined)).toBeNull();
  });

  it("returns the response itself when there is nothing to carry", () => {
    const cases: [Request, Response][] = [
      [createRequest("/account"), loginRedirect()],
      [createRequest("/account?z=ads"), new Response("ok")],
      [createRequest("/account?z=ads"), Response.redirect("https://pay.example.com/checkout", 303)],
      [createRequest("/account?z=ads"), Response.redirect(`${APP_ORIGIN}/login?z=other`, 307)],
      [createRequest("/account?z=ads"), new Response(null, { status: 302 })],
      [createRequest("/account?z=ads"), new Response(null, { status: 302, headers: { location: "http://[bad" } })],
    ];
    for (const [request, response] of cases) {
      expect(channels.carry(request, response)).toBe(response);
    }
  });
});
