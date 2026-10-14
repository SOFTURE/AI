// Signed requests: the header the signer writes, and every way the verifier refuses one.
import { createHmac } from "node:crypto";
import { MIN_SIGNING_SECRET_LENGTH, signRequestBody, verifySignedRequest } from "@softure-ai/security";
import * as signedRequestEntry from "@softure-ai/security/signed-request";
import { describe, expect, it } from "vitest";

const SECRET = "a".repeat(MIN_SIGNING_SECRET_LENGTH);
const OLD_SECRET = "b".repeat(MIN_SIGNING_SECRET_LENGTH);
const NOW = new Date("2026-10-14T12:00:00Z");
const NOW_SECONDS = 1_791_979_200;
const INVALID = { ok: false, error: "security.signature_invalid" };

function secondsLater(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}

describe("signRequestBody", () => {
  it("writes t=<unix seconds>,v1=<HMAC-SHA256 hex of '<t>.<body>'>", async () => {
    const expected = createHmac("sha256", SECRET).update(`${String(NOW_SECONDS)}.hello`).digest("hex");
    expect(await signRequestBody({ secret: SECRET, body: "hello", now: NOW })).toBe(`t=${String(NOW_SECONDS)},v1=${expected}`);
  });

  it("signs bytes and the same text as UTF-8 alike", async () => {
    const text = await signRequestBody({ secret: SECRET, body: "€", now: NOW });
    const bytes = await signRequestBody({ secret: SECRET, body: new Uint8Array([0xe2, 0x82, 0xac]), now: NOW });
    expect(bytes).toBe(text);
  });

  it("writes one v1 per secret while a secret is rotated out", async () => {
    const header = await signRequestBody({ secret: [SECRET, OLD_SECRET], body: "x", now: NOW });
    expect(header.match(/v1=/g)).toHaveLength(2);
  });

  it.each([["short", "a".repeat(MIN_SIGNING_SECRET_LENGTH - 1)], ["empty list", []]])("throws on a %s secret", async (_, secret) => {
    await expect(signRequestBody({ secret, body: "x", now: NOW })).rejects.toThrow("signRequestBody: every secret must be at least 32");
  });

  it("throws on an invalid date", async () => {
    await expect(signRequestBody({ secret: SECRET, body: "x", now: new Date(Number.NaN) })).rejects.toThrow("now is an invalid date");
  });
});

describe("verifySignedRequest", () => {
  async function headerFor(body: string | Uint8Array, secret: string | readonly string[] = SECRET, now = NOW): Promise<string> {
    return signRequestBody({ secret, body, now });
  }

  it("accepts a request signed with the secret within the window", async () => {
    const header = await headerFor("hello");
    expect(await verifySignedRequest({ secret: SECRET, header, body: "hello", now: secondsLater(299) })).toEqual({ ok: true, value: undefined });
  });

  it("accepts raw bytes in a charset that is not UTF-8", async () => {
    const body = new Uint8Array([0xbf, 0xf3, 0xb3, 0x77]);
    const header = await headerFor(body);
    expect((await verifySignedRequest({ secret: SECRET, header, body, now: NOW })).ok).toBe(true);
  });

  it("refuses a body changed after signing", async () => {
    const header = await headerFor("amount=10");
    expect(await verifySignedRequest({ secret: SECRET, header, body: "amount=99", now: NOW })).toEqual(INVALID);
  });

  it("refuses a signature made with another secret", async () => {
    const header = await headerFor("hello", OLD_SECRET);
    expect(await verifySignedRequest({ secret: SECRET, header, body: "hello", now: NOW })).toEqual(INVALID);
  });

  it("accepts the old secret while the receiver lists both", async () => {
    const header = await headerFor("hello", OLD_SECRET);
    expect((await verifySignedRequest({ secret: [SECRET, OLD_SECRET], header, body: "hello", now: NOW })).ok).toBe(true);
  });

  it("accepts a header with several v1 values when one matches", async () => {
    const header = await headerFor("hello", [OLD_SECRET, SECRET]);
    expect((await verifySignedRequest({ secret: SECRET, header, body: "hello", now: NOW })).ok).toBe(true);
  });

  it.each([
    ["stale", -301],
    ["from the future", 301],
  ])("refuses a timestamp %s beyond the tolerance", async (_, offset) => {
    const header = await headerFor("hello", SECRET, secondsLater(offset));
    expect(await verifySignedRequest({ secret: SECRET, header, body: "hello", now: NOW })).toEqual(INVALID);
  });

  it("uses the tolerance it is given", async () => {
    const header = await headerFor("hello", SECRET, secondsLater(-10));
    expect(await verifySignedRequest({ secret: SECRET, header, body: "hello", now: NOW, toleranceSeconds: 9 })).toEqual(INVALID);
    expect((await verifySignedRequest({ secret: SECRET, header, body: "hello", now: NOW, toleranceSeconds: 10 })).ok).toBe(true);
  });

  it.each([
    ["a missing secret", undefined],
    ["an empty secret", ""],
    ["a short secret", "a".repeat(MIN_SIGNING_SECRET_LENGTH - 1)],
    ["an empty secret list", []],
    ["a list with a short secret", [SECRET, "short"]],
  ])("fails closed on %s", async (_, secret) => {
    const header = await headerFor("hello");
    expect(await verifySignedRequest({ secret, header, body: "hello", now: NOW })).toEqual(INVALID);
  });

  it("refuses a request without the header", async () => {
    expect(await verifySignedRequest({ secret: SECRET, header: null, body: "hello", now: NOW })).toEqual(INVALID);
  });

  it.each([
    ["no timestamp", (v1: string) => `v1=${v1}`],
    ["a repeated timestamp", (v1: string) => `t=${String(NOW_SECONDS)},t=${String(NOW_SECONDS)},v1=${v1}`],
    ["a timestamp that is not a number", (v1: string) => `t=soon,v1=${v1}`],
    ["no v1", () => `t=${String(NOW_SECONDS)}`],
    ["a v1 that is not 64 lowercase hex", (v1: string) => `t=${String(NOW_SECONDS)},v1=${v1.toUpperCase()}`],
    ["garbage", () => "not a signature"],
  ])("refuses a header with %s", async (_, build) => {
    const valid = await headerFor("hello");
    const v1 = valid.split("v1=")[1] ?? "";
    expect(await verifySignedRequest({ secret: SECRET, header: build(v1), body: "hello", now: NOW })).toEqual(INVALID);
  });

  it("ignores unknown keys and spaces around entries", async () => {
    const valid = await headerFor("hello");
    const header = ` v0=old , ${valid.replace(",", " , ")}`;
    expect((await verifySignedRequest({ secret: SECRET, header, body: "hello", now: NOW })).ok).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN])("throws on toleranceSeconds %s", async (toleranceSeconds) => {
    await expect(verifySignedRequest({ secret: SECRET, header: null, body: "", now: NOW, toleranceSeconds })).rejects.toThrow(
      "verifySignedRequest: toleranceSeconds must be a whole number of seconds",
    );
  });
});

describe("@softure-ai/security/signed-request", () => {
  it("exports the helpers without the module factory, for an edge worker", () => {
    expect(Object.keys(signedRequestEntry).sort()).toEqual([
      "MIN_SIGNING_SECRET_LENGTH",
      "SIGNED_REQUEST_TOLERANCE_SECONDS",
      "signRequestBody",
      "verifySignedRequest",
    ]);
  });
});
