import { createAuthGuard } from "@softure-ai/auth/proxy";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

const config = createConfig({ appOrigin: "https://app.example.com" });
const guard = createAuthGuard(config, { protect: ["/account", "/dashboard/"] });

function request(path: string, cookie?: string): Request {
  // The internal host a reverse proxy forwards to; redirects must not use it.
  return new Request(`http://10.0.0.5:3000${path}`, { headers: cookie === undefined ? {} : { cookie } });
}

describe("createAuthGuard", () => {
  it("redirects a protected path without a session cookie to the login page on appOrigin, keeping the path", () => {
    const response = guard(request("/account/billing?tab=invoices"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("https://app.example.com/login?next=%2Faccount%2Fbilling%3Ftab%3Dinvoices");
  });

  it("lets a protected path with a session cookie through", () => {
    expect(guard(request("/account", "theme=dark; __Host-softure_session=abc"))).toBeNull();
  });

  it("treats an empty session cookie or another cookie's name as no session", () => {
    expect(guard(request("/account", "__Host-softure_session="))?.status).toBe(307);
    expect(guard(request("/account", "softure_session=abc"))?.status).toBe(307);
    expect(guard(request("/account", "x__Host-softure_session=abc"))?.status).toBe(307);
  });

  it.each(["/", "/login", "/accounting", "/dashboards", "/public/account"])("lets %s through without a cookie", (path) => {
    expect(guard(request(path))).toBeNull();
  });

  it.each(["/account", "/account/", "/dashboard", "/dashboard/stats"])("guards %s, matching whole segments", (path) => {
    expect(guard(request(path))?.status).toBe(307);
  });

  it.each(["/%61ccount", "/ACCOUNT/password", "/Account", "/%E0%A4%A"])("guards the encoded or differently cased path %s", (path) => {
    expect(guard(request(path))?.status).toBe(307);
  });

  it("always guards the change-password route", () => {
    const bare = createAuthGuard(config, { protect: [] });
    expect(bare(request("/account/password"))?.status).toBe(307);
    expect(bare(request("/account"))).toBeNull();
  });

  it("follows the app's route overrides and cookie name", () => {
    const custom = createConfig({ appOrigin: "http://localhost:3000", auth: { cookie: { name: "sid" }, routes: { login: "/sign-in" } } });
    const customGuard = createAuthGuard(custom, { protect: ["/app"] });
    expect(customGuard(request("/app"))?.headers.get("location")).toBe("http://localhost:3000/sign-in?next=%2Fapp");
    expect(customGuard(request("/app", "sid=abc"))).toBeNull();
  });

  it("refuses a protected path that does not start with /", () => {
    expect(() => createAuthGuard(config, { protect: ["account"] })).toThrow('createAuthGuard: protected path "account" must start with /');
  });

  describe("deny by default", () => {
    const denyAll = createAuthGuard(config, { protect: ["/"], exclude: ["/", "/pricing", "/blog", "/api/public/"] });

    it.each(["/login", "/login?next=%2Faccount", "/register", "/forgot-password", "/reset-password?token=x", "/api/auth/session"])(
      "never guards auth's own public route %s, so protect: ['/'] cannot loop",
      (path) => {
        expect(denyAll(request(path))).toBeNull();
        expect(createAuthGuard(config, { protect: ["/"] })(request(path))).toBeNull();
      },
    );

    it.each(["/", "/pricing", "/pricing/annual", "/blog/first-post", "/api/public/stats", "/BLOG/x"])("lets the excluded path %s through", (path) => {
      expect(denyAll(request(path))).toBeNull();
    });

    it.each(["/dashboard", "/pricingx", "/settings/blog", "/account/password", "/%E0%A4%A"])("guards %s, which no exclusion covers", (path) => {
      expect(denyAll(request(path))?.status).toBe(307);
    });

    it("keeps guarding everything else when the app mounts its login page at /", () => {
      const homeLogin = createConfig({ appOrigin: "https://app.example.com", auth: { routes: { login: "/" } } });
      const homeGuard = createAuthGuard(homeLogin, { protect: ["/"] });
      expect(homeGuard(request("/"))).toBeNull();
      expect(homeGuard(request("/dashboard"))?.status).toBe(307);
    });

    it("reads / in exclude as the home page only, not every path", () => {
      expect(createAuthGuard(config, { protect: ["/"], exclude: ["/"] })(request("/dashboard"))?.status).toBe(307);
    });

    it("keeps the change-password route guarded even under an excluded prefix", () => {
      expect(createAuthGuard(config, { protect: ["/"], exclude: ["/account"] })(request("/account/password"))?.status).toBe(307);
      expect(createAuthGuard(config, { protect: ["/"], exclude: ["/account"] })(request("/account/profile"))).toBeNull();
    });

    it("refuses an excluded path that does not start with /", () => {
      expect(() => createAuthGuard(config, { protect: ["/"], exclude: ["pricing"] })).toThrow('createAuthGuard: excluded path "pricing" must start with /');
    });
  });

  it("counts the legacy session cookie as a session when the app declares one", () => {
    const legacyConfig = createConfig({ appOrigin: "https://app.example.com", auth: { legacySession: { cookieName: "session", tokenPattern: /[0-9a-f]{64}/ } } });
    const legacyGuard = createAuthGuard(legacyConfig, { protect: ["/account"] });
    expect(legacyGuard(request("/account", `session=${"a".repeat(64)}`))).toBeNull();
    expect(legacyGuard(request("/account", "session="))?.status).toBe(307);
    expect(guard(request("/account", `session=${"a".repeat(64)}`))?.status).toBe(307);
  });
  describe("trusted origins", () => {
    const multiHost = createAuthGuard(config, { protect: ["/account"], trustedOrigins: ["https://example.com/", "https://admin.example.com:8443"] });

    function forwarded(headers: Record<string, string>, url = "http://10.0.0.5:3000/account?tab=1"): Request {
      return new Request(url, { headers });
    }

    it("keeps the login redirect on a listed origin the front proxy forwarded", () => {
      const response = multiHost(forwarded({ "x-forwarded-host": "example.com", "x-forwarded-proto": "https" }));
      expect(response?.headers.get("location")).toBe("https://example.com/login?next=%2Faccount%3Ftab%3D1");
    });

    it("reads the first value of a forwarded list and compares hosts case-insensitively", () => {
      const response = multiHost(forwarded({ "x-forwarded-host": "EXAMPLE.com, proxy.internal", "x-forwarded-proto": "https,http" }));
      expect(response?.headers.get("location")).toBe("https://example.com/login?next=%2Faccount%3Ftab%3D1");
    });

    it("falls back to the Host header and the URL's scheme without forwarded headers", () => {
      expect(multiHost(forwarded({ host: "example.com" }, "https://example.com/account"))?.headers.get("location")).toBe(
        "https://example.com/login?next=%2Faccount",
      );
    });

    it("matches a port only against an entry with that port", () => {
      expect(multiHost(forwarded({ "x-forwarded-host": "admin.example.com:8443", "x-forwarded-proto": "https" }))?.headers.get("location")).toBe(
        "https://admin.example.com:8443/login?next=%2Faccount%3Ftab%3D1",
      );
      expect(multiHost(forwarded({ "x-forwarded-host": "admin.example.com", "x-forwarded-proto": "https" }))?.headers.get("location")).toBe(
        "https://app.example.com/login?next=%2Faccount%3Ftab%3D1",
      );
    });

    it.each([
      ["an unlisted host", { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" }],
      ["a listed host over another scheme", { "x-forwarded-host": "example.com", "x-forwarded-proto": "http" }],
      ["a host that does not parse", { "x-forwarded-host": "exa mple.com/", "x-forwarded-proto": "https" }],
      ["a host smuggling a path", { "x-forwarded-host": "example.com/evil", "x-forwarded-proto": "https" }],
      ["a host carrying credentials", { "x-forwarded-host": "user@example.com", "x-forwarded-proto": "https" }],
    ])("redirects %s to appOrigin", (_label, headers) => {
      expect(multiHost(forwarded(headers))?.headers.get("location")).toBe("https://app.example.com/login?next=%2Faccount%3Ftab%3D1");
    });

    it("keeps appOrigin for every host without the option, as before", () => {
      expect(guard(forwarded({ "x-forwarded-host": "example.com", "x-forwarded-proto": "https" }))?.headers.get("location")).toBe(
        "https://app.example.com/login?next=%2Faccount%3Ftab%3D1",
      );
    });

    it("lets a request with a session through whatever its host", () => {
      expect(multiHost(forwarded({ "x-forwarded-host": "evil.example", cookie: "__Host-softure_session=abc" }))).toBeNull();
    });

    it.each(["example.com", "https://example.com/path", "https://example.com?x=1", "ftp://example.com", "https://user@example.com", ""])(
      "refuses the trusted origin %j at creation",
      (origin) => {
        expect(() => createAuthGuard(config, { protect: ["/account"], trustedOrigins: [origin] })).toThrow(
          `createAuthGuard: trusted origin "${origin}" must be an http(s) origin such as https://example.com`,
        );
      },
    );
  });
});
