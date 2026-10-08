// The proxy piece's scope, redirect host and navigation check (#242): `targets` limits which navigations
// `tag` redirects, a request served without a proxy keeps its own host, and `isNavigation` is exported so
// an app's tests can build a request the tagger acts on.
import { createChannelTagger, isNavigation } from "@softure-ai/analytics/proxy";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createConfig, createRequest } from "./support.js";

const TAGGED_HOME = `${APP_ORIGIN}/?z=newsletter`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tag with a list of targets", () => {
  const channels = createChannelTagger(createConfig(), { targets: ["/calculator", "/register", "/café"] });

  it("redirects a navigation to a listed path", () => {
    expect(channels.tag(createRequest("/register", { referer: TAGGED_HOME }))?.headers.get("location")).toBe(`${APP_ORIGIN}/register?z=newsletter`);
    expect(channels.tag(createRequest("/calculator?x=1", { referer: TAGGED_HOME }))?.headers.get("location")).toBe(`${APP_ORIGIN}/calculator?x=1&z=newsletter`);
  });

  it("lets any other path through, including a prefetch and a sub-path", () => {
    for (const path of ["/pricing", "/login", "/blog", "/register/", "/register/step", "/"]) {
      expect(channels.tag(createRequest(path, { referer: TAGGED_HOME }))).toBeNull();
    }
    expect(channels.tag(createRequest("/pricing", { referer: TAGGED_HOME, nextUrl: "/", destination: "empty" }))).toBeNull();
  });

  it("compares a listed path with the target's encoded pathname", () => {
    expect(channels.tag(createRequest("/caf%C3%A9", { referer: TAGGED_HOME }))?.status).toBe(307);
  });

  it("refuses a list that names no path or something that is not a pathname", () => {
    const create = (targets: readonly string[]) => () => createChannelTagger(createConfig(), { targets });
    expect(create([])).toThrow("@softure-ai/analytics: channelTagger.targets must name at least one path");
    for (const bad of ["register", "/register?x=1", "/register#top", "//elsewhere.example.com/", "/\\elsewhere.example.com/", ""]) {
      expect(create([bad])).toThrow(`@softure-ai/analytics: channelTagger.targets: ${JSON.stringify(bad)} is not an absolute pathname`);
    }
  });
});

describe("tag with a predicate", () => {
  it("passes the target and the page the visitor came from", () => {
    const seen: string[] = [];
    const channels = createChannelTagger(createConfig(), {
      targets: ({ target, source }) => {
        seen.push(`${source.pathname} -> ${target.pathname}`);
        return target.pathname === "/register" && source.pathname.startsWith("/blog/");
      },
    });
    expect(channels.tag(createRequest("/register", { referer: `${APP_ORIGIN}/blog/post?z=blog` }))?.headers.get("location")).toBe(`${APP_ORIGIN}/register?z=blog`);
    expect(channels.tag(createRequest("/register", { referer: TAGGED_HOME }))).toBeNull();
    expect(seen).toEqual(["/blog/post -> /register", "/ -> /register"]);
  });

  it("is not asked about a request that would not be tagged anyway", () => {
    const targets = vi.fn(() => true);
    const channels = createChannelTagger(createConfig(), { targets });
    channels.tag(createRequest("/register"));
    channels.tag(createRequest("/register?z=ads", { referer: TAGGED_HOME }));
    channels.tag(createRequest("/register", { referer: TAGGED_HOME, method: "POST" }));
    expect(targets).not.toHaveBeenCalled();
  });

  it("tags only on an answer of true", () => {
    const channels = createChannelTagger(createConfig(), { targets: (() => "yes") as unknown as () => boolean });
    expect(channels.tag(createRequest("/register", { referer: TAGGED_HOME }))).toBeNull();
  });

  it("logs a predicate that throws and tags nothing", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const channels = createChannelTagger(createConfig(), {
      targets: () => {
        throw new Error("boom");
      },
    });
    expect(channels.tag(createRequest("/register", { referer: TAGGED_HOME }))).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("@softure-ai/analytics: channelTagger.targets failed: boom");
  });

  it("refuses a value that is neither a list nor a function", () => {
    expect(() => createChannelTagger(createConfig(), { targets: "/register" as unknown as readonly string[] })).toThrow(
      "@softure-ai/analytics: channelTagger.targets must be a list of pathnames or a function",
    );
  });
});

describe("tag on a host that is not configured", () => {
  const channels = createChannelTagger(createConfig());
  const navigate = (url: string, headers: Record<string, string>) =>
    new Request(url, { headers: { "sec-fetch-mode": "navigate", referer: "http://localhost:3100/?z=ads", ...headers } });

  it("stays on the request's own origin when Host is that origin (no proxy in front)", () => {
    const response = channels.tag(navigate("http://localhost:3100/register", { host: "localhost:3100" }));
    expect(response?.headers.get("location")).toBe("http://localhost:3100/register?z=ads");
  });

  it("takes the scheme from X-Forwarded-Proto", () => {
    const request = navigate("http://shop.example.net/register", { host: "shop.example.net", referer: "http://shop.example.net/?z=ads", "x-forwarded-proto": "https" });
    expect(channels.tag(request)?.headers.get("location")).toBe("https://shop.example.net/register?z=ads");
    const other = navigate("http://shop.example.net/register", { host: "shop.example.net", referer: "http://shop.example.net/?z=ads", "x-forwarded-proto": "gopher" });
    expect(channels.tag(other)?.headers.get("location")).toBe("http://shop.example.net/register?z=ads");
  });

  it("goes to appOrigin when Host is neither configured nor the request's own host", () => {
    const request = navigate("http://10.0.0.5:3000/register", { host: "public.example.org", referer: "http://10.0.0.5:3000/?z=ads" });
    expect(channels.tag(request)?.headers.get("location")).toBe(`${APP_ORIGIN}/register?z=ads`);
  });

  it("prefers a configured origin with the same host", () => {
    const request = navigate("http://app.example.com/register", { host: "app.example.com", referer: `${APP_ORIGIN}/?z=ads` });
    expect(channels.tag(request)?.headers.get("location")).toBe(`${APP_ORIGIN}/register?z=ads`);
  });
});

describe("isNavigation", () => {
  const request = (headers: Record<string, string>, method = "GET") => new Request(`${APP_ORIGIN}/register`, { method, headers });

  it("accepts a browser page load, a Next.js client navigation and its stripped form", () => {
    expect(isNavigation(request({ "sec-fetch-mode": "navigate" }))).toBe(true);
    expect(isNavigation(request({ "sec-fetch-mode": "navigate" }, "HEAD"))).toBe(true);
    expect(isNavigation(request({ rsc: "1" }))).toBe(true);
    expect(isNavigation(request({ "next-url": "/" }))).toBe(true);
    expect(isNavigation(request({ "next-url": "/", "sec-fetch-dest": "empty" }))).toBe(true);
  });

  it("rejects a bare request, a POST, a subresource and a plain fetch", () => {
    expect(isNavigation(request({}))).toBe(false);
    expect(isNavigation(request({ "sec-fetch-mode": "navigate" }, "POST"))).toBe(false);
    expect(isNavigation(request({ "next-url": "/", "sec-fetch-dest": "image" }))).toBe(false);
    expect(isNavigation(request({ "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }))).toBe(false);
  });
});
