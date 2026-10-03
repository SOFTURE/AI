// Reading the channel: the URL's own parameter decides, else a same-origin Referer's.
import { hasChannelParam, parseChannel, readChannel, withChannel } from "@softure-ai/analytics/server";
import { describe, expect, it } from "vitest";
import { APP_ORIGIN, createConfig } from "./support.js";

const OPTIONS = { param: "z", pattern: /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, maxLength: 12 };

describe("parseChannel", () => {
  it("accepts a value that matches the pattern within the length", () => {
    expect(parseChannel("newsletter", OPTIONS)).toBe("newsletter");
    expect(parseChannel("spring-promo", OPTIONS)).toBe("spring-promo");
    expect(parseChannel("a", OPTIONS)).toBe("a");
  });

  it("accepts exactly maxLength characters and refuses one more, never cutting", () => {
    expect(parseChannel("abcdefghijkl", OPTIONS)).toBe("abcdefghijkl");
    expect(parseChannel("abcdefghijklm", OPTIONS)).toBeNull();
  });

  it("refuses empty, missing and malformed values, never repairing them", () => {
    for (const value of ["", null, undefined, "News", " news", "news ", "a--b", "-news", "news-", "news/1", "<script>"]) {
      expect(parseChannel(value, OPTIONS), String(value)).toBeNull();
    }
  });

  it("uses the app's own pattern", () => {
    expect(parseChannel("FB_Ads", { ...OPTIONS, pattern: /^[A-Za-z_]+$/ })).toBe("FB_Ads");
  });
});

describe("readChannel", () => {
  const config = createConfig();

  it("reads the request's own parameter", () => {
    expect(readChannel(config, { url: `${APP_ORIGIN}/?z=newsletter` })).toBe("newsletter");
    expect(readChannel(config, { url: new URL(`${APP_ORIGIN}/pricing?a=1&z=ads`) })).toBe("ads");
  });

  it("lets the request's own parameter win over the Referer, even when it is invalid", () => {
    expect(readChannel(config, { url: `${APP_ORIGIN}/?z=mine`, referer: `${APP_ORIGIN}/?z=theirs` })).toBe("mine");
    expect(readChannel(config, { url: `${APP_ORIGIN}/?z=BAD`, referer: `${APP_ORIGIN}/?z=theirs` })).toBeNull();
    expect(readChannel(config, { url: `${APP_ORIGIN}/?z=`, referer: `${APP_ORIGIN}/?z=theirs` })).toBeNull();
  });

  it("falls back to a same-origin Referer when the URL has no parameter", () => {
    expect(readChannel(config, { url: `${APP_ORIGIN}/register`, referer: `${APP_ORIGIN}/?z=newsletter` })).toBe("newsletter");
  });

  it("accepts the request's own origin, which differs from appOrigin behind a proxy", () => {
    expect(readChannel(config, { url: "http://10.0.0.5:3000/register", referer: "http://10.0.0.5:3000/?z=ads" })).toBe("ads");
  });

  it("ignores a Referer from another origin, scheme or port", () => {
    for (const referer of ["https://evil.example.com/?z=ads", "http://app.example.com/?z=ads", "https://app.example.com:8443/?z=ads", "javascript:alert(1)//?z=ads"]) {
      expect(readChannel(config, { url: `${APP_ORIGIN}/register`, referer }), referer).toBeNull();
    }
  });

  it("checks the Referer against appOrigin or the Host header when there is no request URL", () => {
    expect(readChannel(config, { referer: `${APP_ORIGIN}/register?z=ads` })).toBe("ads");
    expect(readChannel(config, { referer: "http://localhost:3100/register?z=ads", host: "localhost:3100" })).toBe("ads");
    expect(readChannel(config, { referer: "http://localhost:3100/register?z=ads", host: "LOCALHOST:3100" })).toBe("ads");
    expect(readChannel(config, { referer: "http://localhost:3100/register?z=ads", host: "localhost:3000" })).toBeNull();
    expect(readChannel(config, { referer: "http://localhost:3100/register?z=ads" })).toBeNull();
  });

  it("returns null without a channel anywhere, or with an unparsable Referer", () => {
    expect(readChannel(config, { url: `${APP_ORIGIN}/` })).toBeNull();
    expect(readChannel(config, { url: `${APP_ORIGIN}/`, referer: `${APP_ORIGIN}/about` })).toBeNull();
    expect(readChannel(config, { url: `${APP_ORIGIN}/`, referer: "not a url" })).toBeNull();
    expect(readChannel(config, { url: `${APP_ORIGIN}/`, referer: "" })).toBeNull();
    expect(readChannel(config, {})).toBeNull();
  });

  it("reads the parameter the app configured", () => {
    const custom = createConfig({ channel: { param: "ref" } });
    expect(readChannel(custom, { url: `${APP_ORIGIN}/?ref=ads&z=other` })).toBe("ads");
    expect(readChannel(custom, { url: `${APP_ORIGIN}/?z=other` })).toBeNull();
  });
});

describe("hasChannelParam and withChannel", () => {
  const config = createConfig();

  it("tells whether the parameter is present, whatever its value", () => {
    expect(hasChannelParam(config, new URL(`${APP_ORIGIN}/?z=`))).toBe(true);
    expect(hasChannelParam(config, new URL(`${APP_ORIGIN}/?zz=1`))).toBe(false);
  });

  it("sets the parameter on a copy, keeping the path, the other parameters and the hash", () => {
    const url = new URL(`${APP_ORIGIN}/login?next=%2Faccount#form`);
    expect(withChannel(config, url, "ads").href).toBe(`${APP_ORIGIN}/login?next=%2Faccount&z=ads#form`);
    expect(url.href).toBe(`${APP_ORIGIN}/login?next=%2Faccount#form`);
  });
});
