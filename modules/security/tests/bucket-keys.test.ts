// What a bucket is keyed by (`key`), the listing an app builds its privacy policy from, and
// overriding one threshold of a package's bucket defaults.
import { defineSoftureConfig } from "@softure-ai/core";
import { headerIp, overrideBuckets, RATE_LIMIT_KEY_KINDS, security } from "@softure-ai/security";
import { listRateLimitBuckets } from "@softure-ai/security/server";
import { describe, expect, it } from "vitest";

const DEFAULTS = {
  login: { limit: 50, windowMinutes: 15, key: "ip" },
  "login-account": { limit: 10, windowMinutes: 15, key: "account" },
} as const;

describe("bucket key kinds", () => {
  it("names the three kinds", () => {
    expect(RATE_LIMIT_KEY_KINDS).toEqual(["ip", "account", "subject"]);
  });

  it("accepts a bucket with a key kind and one without", () => {
    const module = security({
      clientIp: headerIp("x-real-ip"),
      buckets: { login: { limit: 5, windowMinutes: 15, key: "ip" }, legacy: { limit: 5, windowMinutes: 15 } },
    });
    expect(module.options.buckets).toEqual({
      login: { limit: 5, windowMinutes: 15, key: "ip" },
      legacy: { limit: 5, windowMinutes: 15 },
    });
  });

  it("refuses an unknown kind, naming the bucket", () => {
    expect(() =>
      // @ts-expect-error: the test passes a value the types already forbid, as a JavaScript config could.
      security({ clientIp: headerIp("x-real-ip"), buckets: { login: { limit: 5, windowMinutes: 15, key: "email" } } }),
    ).toThrow('- options.buckets.login.key: Invalid option: expected one of "ip"|"account"|"subject"');
  });
});

describe("listRateLimitBuckets", () => {
  it("lists every configured bucket with its kind, in configuration order", () => {
    const config = defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "Europe/Warsaw",
      appOrigin: "http://localhost:3000",
      modules: [
        security({
          clientIp: headerIp("x-real-ip"),
          buckets: { ...DEFAULTS, "waitlist-email": { limit: 3, windowMinutes: 60, key: "subject" }, legacy: { limit: 1, windowMinutes: 1 } },
        }),
      ],
    });
    expect(listRateLimitBuckets(config)).toEqual([
      { name: "login", limit: 50, windowMinutes: 15, key: "ip" },
      { name: "login-account", limit: 10, windowMinutes: 15, key: "account" },
      { name: "waitlist-email", limit: 3, windowMinutes: 60, key: "subject" },
      { name: "legacy", limit: 1, windowMinutes: 1, key: undefined },
    ]);
    expect(listRateLimitBuckets(config).filter((bucket) => bucket.key === "ip").map((bucket) => bucket.name)).toEqual(["login"]);
  });

  it("throws when the module is not enabled", () => {
    const config = defineSoftureConfig({ database: null, locale: "en", timezone: "Europe/Warsaw", appOrigin: "http://localhost:3000", modules: [] });
    expect(() => listRateLimitBuckets(config)).toThrow("@softure-ai/security: the module is not enabled");
  });
});

describe("overrideBuckets", () => {
  it("changes one threshold and keeps the rest of the bucket and the other buckets", () => {
    expect(overrideBuckets(DEFAULTS, { login: { limit: 200 } })).toEqual({
      login: { limit: 200, windowMinutes: 15, key: "ip" },
      "login-account": { limit: 10, windowMinutes: 15, key: "account" },
    });
  });

  it("leaves the defaults untouched", () => {
    overrideBuckets(DEFAULTS, { login: { limit: 200, windowMinutes: 5 } });
    expect(DEFAULTS.login).toEqual({ limit: 50, windowMinutes: 15, key: "ip" });
  });

  it("returns an equal copy without overrides", () => {
    const copy = overrideBuckets(DEFAULTS, {});
    expect(copy).toEqual(DEFAULTS);
    expect(copy).not.toBe(DEFAULTS);
  });

  it("throws on a bucket the defaults do not define", () => {
    // @ts-expect-error: the test passes a name the types already forbid, as a typo in JavaScript could.
    expect(() => overrideBuckets(DEFAULTS, { logn: { limit: 1 } })).toThrow(
      'overrideBuckets: no bucket "logn" in the defaults; known buckets: login, login-account',
    );
  });
});
