// An app served on two first-party origins behind a proxy: public pages on the apex, the product on
// appOrigin. The request URL carries the server's internal host; `Host` names the public one.
import { analytics } from "@softure-ai/analytics";
import { createChannelTagger } from "@softure-ai/analytics/proxy";
import { getFirstPartyOrigins, handleFunnelBeacon, handleFunnelPixel, readPublicOrigin } from "@softure-ai/analytics/server";
import { defineSoftureConfig } from "@softure-ai/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createConfig, createTestFunnel, FUNNEL_STEPS, listCounts, type TestFunnel } from "./support.js";

const APEX = "https://example.com";
const INTERNAL = "http://localhost:3100";

let funnel: TestFunnel | undefined;

afterEach(async () => {
  await funnel?.database.close();
  funnel = undefined;
  vi.restoreAllMocks();
});

/** A request as the app's server sees it behind the proxy: internal URL, public `Host`. */
function proxied(path: string, headers: Record<string, string>, init: { method?: string; body?: string } = {}): Request {
  return new Request(`${INTERNAL}${path}`, { method: init.method ?? "GET", body: init.body ?? null, headers });
}

describe("analytics({ origins })", () => {
  it("reduces each origin to its origin and adds them after appOrigin, without repeats", () => {
    const config = createConfig({ origins: ["https://Example.com/", APP_ORIGIN, "https://example.com"] });
    expect(getFirstPartyOrigins(config)).toEqual([APP_ORIGIN, APEX]);
    expect(getFirstPartyOrigins(createConfig())).toEqual([APP_ORIGIN]);
  });

  it("refuses an origin with a path, a query, credentials or another scheme", () => {
    for (const origin of ["https://example.com/blog", "https://example.com/?z=a", "https://user@example.com", "ftp://example.com", "example.com"]) {
      expect(() => defineSoftureConfig({ database: { url: "pglite://" }, locale: "en", timezone: "UTC", appOrigin: APP_ORIGIN, modules: [analytics({ origins: [origin] })] })).toThrow();
    }
  });
});

describe("readPublicOrigin", () => {
  const config = createConfig({ origins: [APEX, "http://example.com"] });

  it("maps Host onto a configured origin, preferring the scheme X-Forwarded-Proto names", () => {
    expect(readPublicOrigin(config, proxied("/", { host: "example.com", "x-forwarded-proto": "https" }))).toBe(APEX);
    expect(readPublicOrigin(config, proxied("/", { host: "example.com", "x-forwarded-proto": "http, https" }))).toBe("http://example.com");
    expect(readPublicOrigin(config, proxied("/", { host: "app.example.com", "x-forwarded-proto": "http" }))).toBe(APP_ORIGIN);
    expect(readPublicOrigin(config, proxied("/", { host: "APP.example.com" }))).toBe(APP_ORIGIN);
  });

  it("is null for a host that is not configured, so a forged Host selects nothing", () => {
    expect(readPublicOrigin(config, proxied("/", { host: "evil.example.net", "x-forwarded-proto": "https" }))).toBeNull();
    expect(readPublicOrigin(config, new Request(`${INTERNAL}/`))).toBeNull();
  });
});

describe("the funnel endpoint behind a proxy", () => {
  const options = { origins: [APEX], funnel: { steps: [...FUNNEL_STEPS] } };

  it("counts a pixel and a beacon from a page on the second origin while request.url is internal", async () => {
    funnel = await createTestFunnel(options);
    const headers = { host: "example.com", "x-forwarded-proto": "https", "sec-fetch-site": "same-origin" };
    expect((await handleFunnelPixel(funnel.ctx, proxied("/api/analytics/funnel?step=landing", { ...headers, referer: `${APEX}/?z=fb` }))).status).toBe(200);
    await handleFunnelBeacon(funnel.ctx, proxied("/api/analytics/funnel", { ...headers, referer: `${APEX}/kalkulator?z=fb` }, { method: "POST", body: "step=pricing" }));
    expect((await listCounts(funnel)).map(({ channel, step, count }) => ({ channel, step, count }))).toEqual([
      { channel: "fb", step: "landing", count: 1 },
      { channel: "fb", step: "pricing", count: 1 },
    ]);
  });

  it("still ignores a page on an origin that is not configured", async () => {
    funnel = await createTestFunnel(options);
    await handleFunnelPixel(funnel.ctx, proxied("/api/analytics/funnel?step=landing", { host: "example.com", referer: "https://other.example.net/?z=fb" }));
    expect(await listCounts(funnel)).toEqual([]);
  });

  it("counts nothing from the apex without origins (the 0.1.7 behaviour the option fixes)", async () => {
    funnel = await createTestFunnel();
    await handleFunnelPixel(funnel.ctx, proxied("/api/analytics/funnel?step=landing", { host: "example.com", referer: `${APEX}/?z=fb` }));
    expect(await listCounts(funnel)).toEqual([]);
  });
});

describe("the tagger on two origins", () => {
  const channels = createChannelTagger(createConfig({ origins: [APEX] }));
  const navigate = { "sec-fetch-mode": "navigate", "x-forwarded-proto": "https" };

  it("redirects on the request's public origin, never moving the visitor to appOrigin", () => {
    const response = channels.tag(proxied("/kalkulator", { ...navigate, host: "example.com", referer: `${APEX}/?z=fb` }));
    expect(response?.headers.get("location")).toBe(`${APEX}/kalkulator?z=fb`);
  });

  it("reads a tag from a page on the other configured origin", () => {
    const response = channels.tag(proxied("/register", { ...navigate, host: "app.example.com", referer: `${APEX}/?z=fb` }));
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/register?z=fb`);
  });

  it("falls back to appOrigin for a Host it does not know", () => {
    const response = channels.tag(proxied("/register", { ...navigate, host: "evil.example.net", referer: `${APP_ORIGIN}/?z=fb` }));
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/register?z=fb`);
  });

  it("keeps a relative Location relative when it carries the tag", () => {
    const redirect = new Response(null, { status: 307, headers: { location: "/login?next=%2Fpulpit" } });
    const response = channels.carry(proxied("/pulpit", { host: "app.example.com", referer: `${APEX}/?z=fb` }), redirect);
    expect(response?.headers.get("location")).toBe("/login?next=%2Fpulpit&z=fb");
  });

  it("tags an absolute redirect to the other configured origin", () => {
    const redirect = Response.redirect(`${APP_ORIGIN}/login`, 307);
    const response = channels.carry(proxied("/start?z=fb", { host: "example.com" }), redirect);
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/login?z=fb`);
  });
});

describe("createChannelTagger(config, { channelFromReferer })", () => {
  const fromArticle = (page: URL) => (page.pathname.startsWith("/blog/") ? "blog" : null);
  const channels = createChannelTagger(createConfig({ origins: [APEX] }), { channelFromReferer: fromArticle });
  const navigate = { "sec-fetch-mode": "navigate", host: "example.com" };

  it("tags a navigation from an untagged first-party page with the channel its path implies", () => {
    const response = channels.tag(proxied("/kalkulator", { ...navigate, referer: `${APEX}/blog/fire` }));
    expect(response?.headers.get("location")).toBe(`${APEX}/kalkulator?z=blog`);
  });

  it("lets the page's own parameter decide, valid or not, and ignores third-party pages", () => {
    expect(channels.tag(proxied("/kalkulator", { ...navigate, referer: `${APEX}/blog/fire?z=fb` }))?.headers.get("location")).toBe(`${APEX}/kalkulator?z=fb`);
    expect(channels.tag(proxied("/kalkulator", { ...navigate, referer: `${APEX}/blog/fire?z=Bad!` }))).toBeNull();
    expect(channels.tag(proxied("/kalkulator", { ...navigate, referer: "https://other.example.net/blog/fire" }))).toBeNull();
    expect(channels.tag(proxied("/kalkulator", { ...navigate, referer: `${APEX}/about` }))).toBeNull();
  });

  it("carries the derived channel through a redirect", () => {
    const response = channels.carry(proxied("/pulpit", { host: "example.com", referer: `${APEX}/blog/fire` }), Response.redirect(`${APEX}/login`, 307));
    expect(response?.headers.get("location")).toBe(`${APEX}/login?z=blog`);
  });

  it("tags nothing when the hook throws or answers an invalid channel, and logs the throw", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const throwing = createChannelTagger(createConfig(), {
      channelFromReferer: () => {
        throw new Error("boom");
      },
    });
    expect(throwing.tag(proxied("/x", { ...navigate, host: "app.example.com", referer: `${APP_ORIGIN}/blog/a` }))).toBeNull();
    expect(error).toHaveBeenCalledWith("@softure-ai/analytics: channelFromReferer failed: boom");
    const invalid = createChannelTagger(createConfig(), { channelFromReferer: () => "Not Valid" });
    expect(invalid.tag(proxied("/x", { ...navigate, host: "app.example.com", referer: `${APP_ORIGIN}/blog/a` }))).toBeNull();
  });
});
