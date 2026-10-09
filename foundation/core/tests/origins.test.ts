import { describe, expect, it } from "vitest";
import { defineSoftureConfig, getTrustedOrigins, parseOrigin, readForwardedProto, readRequestHost, readRequestOrigin, resolveAppOrigin } from "@softure-ai/core";
import { catchConfigError } from "./support.js";

const APP = "https://app.example.com";
const APEX = "https://example.com";
const INTERNAL = "http://0.0.0.0:3000/path?x=1";

const base = { locale: "en", timezone: "UTC", appOrigin: APP, modules: [] } as const;

/** A request as a server behind a proxy sees it: its own listening address in the URL. */
function at(headers: Record<string, string>, url = INTERNAL): Request {
  return new Request(url, { headers });
}

describe("parseOrigin", () => {
  it("normalizes an http(s) origin, a trailing slash allowed", () => {
    expect(parseOrigin("https://Example.COM/")).toBe(APEX);
    expect(parseOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(parseOrigin("https://example.com:443")).toBe(APEX);
  });

  it.each(["https://example.com/path", "https://example.com/?q", "https://example.com#x", "https://user@example.com", "ftp://example.com", "example.com", "https://exa mple.com", "https://", ""])(
    "is null for %j",
    (value) => {
      expect(parseOrigin(value)).toBeNull();
    },
  );
});

describe("readRequestHost", () => {
  it("reads the first Host value, lowercased, else the URL's host", () => {
    expect(readRequestHost(at({ host: "Example.COM, other.example" }))).toBe("example.com");
    expect(readRequestHost(at({}))).toBe("0.0.0.0:3000");
  });

  it("reads X-Forwarded-Host first only when asked to", () => {
    const request = at({ host: "proxy.internal", "x-forwarded-host": " Example.com , proxy.internal" });
    expect(readRequestHost(request)).toBe("proxy.internal");
    expect(readRequestHost(request, { forwardedHost: true })).toBe("example.com");
    expect(readRequestHost(at({ host: "example.com" }), { forwardedHost: true })).toBe("example.com");
  });

  it("reads Next's headers() with a URL as well as a Request", () => {
    expect(readRequestHost({ url: INTERNAL, headers: new Headers({ host: "example.com" }) })).toBe("example.com");
  });
});

describe("readForwardedProto", () => {
  it("is the first X-Forwarded-Proto value when it is http or https, else null", () => {
    expect(readForwardedProto(at({ "x-forwarded-proto": " HTTPS , http" }))).toBe("https");
    expect(readForwardedProto(at({ "x-forwarded-proto": "http" }))).toBe("http");
    expect(readForwardedProto(at({ "x-forwarded-proto": "wss" }))).toBeNull();
    expect(readForwardedProto(at({}))).toBeNull();
  });
});

describe("readRequestOrigin", () => {
  it("takes the scheme from the first X-Forwarded-Proto value when it is http or https", () => {
    expect(readRequestOrigin(at({ host: "example.com", "x-forwarded-proto": "HTTPS, http" }))).toBe(APEX);
    expect(readRequestOrigin(at({ host: "example.com", "x-forwarded-proto": "http" }))).toBe("http://example.com");
  });

  it("falls back to the URL's scheme for another X-Forwarded-Proto value or none", () => {
    expect(readRequestOrigin(at({ host: "example.com", "x-forwarded-proto": "wss" }))).toBe("http://example.com");
    expect(readRequestOrigin(at({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(readRequestOrigin(new Request("https://example.com:8443/x"))).toBe("https://example.com:8443");
  });

  it("drops a default port", () => {
    expect(readRequestOrigin(at({ host: "example.com:443", "x-forwarded-proto": "https" }))).toBe(APEX);
  });

  it("uses X-Forwarded-Host only when asked to", () => {
    const request = at({ host: "proxy.internal:8080", "x-forwarded-host": "example.com", "x-forwarded-proto": "https" });
    expect(readRequestOrigin(request)).toBe("https://proxy.internal:8080");
    expect(readRequestOrigin(request, { forwardedHost: true })).toBe(APEX);
  });

  it.each(["exa mple.com", "example.com/evil", "user@example.com", "example.com?x", "example.com#x", "example.com\\evil"])(
    "is null for a host that is no host: %j",
    (host) => {
      expect(readRequestOrigin(at({ "x-forwarded-host": host }), { forwardedHost: true })).toBeNull();
    },
  );
});

describe("the origins block of the config", () => {
  it("defaults to no trusted origins and an untrusted request host", () => {
    const config = defineSoftureConfig(base);
    expect(config.origins).toEqual({ trustedOrigins: [], trustRequestHost: false });
    expect(Object.isFrozen(config.origins)).toBe(true);
    expect(Object.isFrozen(config.origins.trustedOrigins)).toBe(true);
  });

  it("keeps trusted origins and the request-host switch", () => {
    const config = defineSoftureConfig({ ...base, origins: { trustedOrigins: [APEX], trustRequestHost: true } });
    expect(config.origins).toEqual({ trustedOrigins: [APEX], trustRequestHost: true });
  });

  it.each([["https://example.com/blog"], ["example.com"], ["ftp://example.com"]])("refuses the trusted origin %j", (origin) => {
    const error = catchConfigError(() => defineSoftureConfig({ ...base, origins: { trustedOrigins: [origin] } }));
    expect(error.issues).toEqual([expect.stringMatching(/^origins\.trustedOrigins\.0: /)]);
  });

  it("refuses an unknown key, so a typo is not silently ignored", () => {
    const error = catchConfigError(() => defineSoftureConfig({ ...base, origins: { trusted: [APEX] } } as never));
    expect(error.issues).toEqual([expect.stringMatching(/^origins: /)]);
  });
});

describe("getTrustedOrigins", () => {
  it("lists appOrigin, the config's trusted origins, then the extra ones, without repeats", () => {
    const config = defineSoftureConfig({ ...base, origins: { trustedOrigins: [APEX] } });
    expect(getTrustedOrigins(config)).toEqual([APP, APEX]);
    expect(getTrustedOrigins(config, ["https://Example.com/", "https://admin.example.com"])).toEqual([APP, APEX, "https://admin.example.com"]);
  });

  it("throws by name for an extra entry that is not an origin", () => {
    expect(() => getTrustedOrigins(defineSoftureConfig(base), ["https://example.com/path"])).toThrow(/trusted origin "https:\/\/example\.com\/path"/);
  });
});

describe("resolveAppOrigin", () => {
  const listed = defineSoftureConfig({ ...base, origins: { trustedOrigins: [APEX] } });

  it("answers a listed origin the request was sent to, read through the proxy's forwarded headers", () => {
    expect(resolveAppOrigin(listed, at({ host: "example.com", "x-forwarded-proto": "https" }))).toBe(APEX);
    expect(resolveAppOrigin(listed, at({ host: "proxy.internal", "x-forwarded-host": "example.com", "x-forwarded-proto": "https" }))).toBe(APEX);
  });

  it("answers appOrigin for an unlisted origin, a listed host on another scheme, or a malformed host", () => {
    expect(resolveAppOrigin(listed, at({ host: "evil.example", "x-forwarded-proto": "https" }))).toBe(APP);
    expect(resolveAppOrigin(listed, at({ host: "example.com", "x-forwarded-proto": "http" }))).toBe(APP);
    expect(resolveAppOrigin(listed, at({ "x-forwarded-host": "example.com/evil" }))).toBe(APP);
  });

  it("takes extra trusted origins from the caller", () => {
    const config = defineSoftureConfig(base);
    const request = at({ host: "admin.example.com", "x-forwarded-proto": "https" });
    expect(resolveAppOrigin(config, request)).toBe(APP);
    expect(resolveAppOrigin(config, request, { trustedOrigins: ["https://admin.example.com"] })).toBe("https://admin.example.com");
  });

  describe("with trustRequestHost", () => {
    const trusting = defineSoftureConfig({ ...base, origins: { trustRequestHost: true } });

    it("answers the origin of Host and X-Forwarded-Proto, whatever the host", () => {
      expect(resolveAppOrigin(trusting, at({ host: "localhost:6510" }))).toBe("http://localhost:6510");
      expect(resolveAppOrigin(trusting, at({ host: "preview.example.net", "x-forwarded-proto": "https" }))).toBe("https://preview.example.net");
    });

    it("never takes an unlisted X-Forwarded-Host, which a client can send through a proxy that keeps it", () => {
      expect(resolveAppOrigin(trusting, at({ host: "localhost:6510", "x-forwarded-host": "evil.example" }))).toBe("http://localhost:6510");
    });

    it("answers appOrigin when Host does not parse", () => {
      expect(resolveAppOrigin(trusting, at({ host: "exa mple.com" }))).toBe(APP);
    });
  });
});
