// Third-party webhook signatures: HMAC over the raw body in hex or base64, with no timestamp. The expected values come
// from `node:crypto`, an implementation independent of the Web Crypto code under test.
import { createHmac } from "node:crypto";
import { signWebhookBody, verifyWebhookSignature, type VerifyWebhookSignatureInput } from "@softure-ai/security/signed-request";
import { describe, expect, it } from "vitest";

const SECRET = "provider-issued-secret";
const OTHER_SECRET = "another-provider-secret";
const BODY = '{"id":42,"topic":"orders/create","note":"café ✓"}';
const INVALID = { ok: false, error: "security.signature_invalid" };

function nodeHmac(algorithm: "sha256" | "sha1", secret: string, body: string, encoding: "hex" | "base64"): string {
  return createHmac(algorithm, secret).update(body, "utf8").digest(encoding);
}

function verify(input: Partial<VerifyWebhookSignatureInput> & Pick<VerifyWebhookSignatureInput, "header">) {
  return verifyWebhookSignature({ secret: SECRET, body: BODY, algorithm: "sha256", encoding: "hex", ...input });
}

describe("verifyWebhookSignature: provider formats", () => {
  it("accepts a GitHub-style signature: sha256 in hex behind a `sha256=` prefix", async () => {
    const header = `sha256=${nodeHmac("sha256", SECRET, BODY, "hex")}`;
    expect(await verify({ header, prefix: "sha256=" })).toEqual({ ok: true, value: undefined });
  });

  it("accepts a legacy SHA-1 signature in hex behind a `sha1=` prefix", async () => {
    const header = `sha1=${nodeHmac("sha1", SECRET, BODY, "hex")}`;
    expect(await verify({ header, algorithm: "sha1", prefix: "sha1=" })).toEqual({ ok: true, value: undefined });
  });

  it("accepts a Shopify-style signature: sha256 in base64 with no prefix", async () => {
    const header = nodeHmac("sha256", SECRET, BODY, "base64");
    expect(await verify({ header, encoding: "base64" })).toEqual({ ok: true, value: undefined });
  });

  it("accepts sha256 in hex with no prefix", async () => {
    expect(await verify({ header: nodeHmac("sha256", SECRET, BODY, "hex") })).toEqual({ ok: true, value: undefined });
  });

  it("accepts upper-case hex and surrounding whitespace", async () => {
    const header = `  sha256=${nodeHmac("sha256", SECRET, BODY, "hex").toUpperCase()}  `;
    expect(await verify({ header, prefix: "sha256=" })).toEqual({ ok: true, value: undefined });
  });

  it("accepts base64 without its padding", async () => {
    const header = nodeHmac("sha256", SECRET, BODY, "base64").replace(/=+$/, "");
    expect(await verify({ header, encoding: "base64" })).toEqual({ ok: true, value: undefined });
  });

  it("verifies raw bytes, and a string body as its UTF-8 bytes", async () => {
    const header = nodeHmac("sha256", SECRET, BODY, "hex");
    expect(await verify({ header, body: new TextEncoder().encode(BODY) })).toEqual({ ok: true, value: undefined });
  });

  it("accepts any secret of a rotation list", async () => {
    const header = nodeHmac("sha256", OTHER_SECRET, BODY, "hex");
    expect(await verify({ header, secret: [SECRET, OTHER_SECRET] })).toEqual({ ok: true, value: undefined });
    expect(await verify({ header, secret: [OTHER_SECRET, SECRET] })).toEqual({ ok: true, value: undefined });
  });
});

describe("verifyWebhookSignature: fails closed", () => {
  const goodHex = nodeHmac("sha256", SECRET, BODY, "hex");

  it("refuses a signature made with another secret", async () => {
    expect(await verify({ header: nodeHmac("sha256", OTHER_SECRET, BODY, "hex") })).toEqual(INVALID);
  });

  it("refuses a body with one byte changed", async () => {
    expect(await verify({ header: goodHex, body: BODY.replace("42", "43") })).toEqual(INVALID);
  });

  it("refuses the re-serialised JSON of a body that was signed with other whitespace", async () => {
    const sent = '{ "id": 42 }';
    const header = nodeHmac("sha256", SECRET, sent, "hex");
    expect(await verify({ header, body: sent })).toEqual({ ok: true, value: undefined });
    expect(await verify({ header, body: JSON.stringify(JSON.parse(sent)) })).toEqual(INVALID);
  });

  it("refuses a missing header, and a header with nothing after the prefix", async () => {
    expect(await verify({ header: null })).toEqual(INVALID);
    expect(await verify({ header: "" })).toEqual(INVALID);
    expect(await verify({ header: "sha256=", prefix: "sha256=" })).toEqual(INVALID);
  });

  it("refuses a missing or empty secret, and a list with an empty secret", async () => {
    expect(await verify({ header: goodHex, secret: undefined })).toEqual(INVALID);
    expect(await verify({ header: goodHex, secret: "" })).toEqual(INVALID);
    expect(await verify({ header: goodHex, secret: [] })).toEqual(INVALID);
    expect(await verify({ header: goodHex, secret: [SECRET, ""] })).toEqual(INVALID);
  });

  it("refuses a header without the expected prefix, with another prefix, or with a prefix nobody expects", async () => {
    expect(await verify({ header: goodHex, prefix: "sha256=" })).toEqual(INVALID);
    expect(await verify({ header: `sha1=${goodHex}`, prefix: "sha256=" })).toEqual(INVALID);
    expect(await verify({ header: `SHA256=${goodHex}`, prefix: "sha256=" })).toEqual(INVALID);
    expect(await verify({ header: `sha256=${goodHex}` })).toEqual(INVALID);
  });

  it("refuses a signature of the wrong length or with characters outside its encoding", async () => {
    expect(await verify({ header: goodHex.slice(0, 62) })).toEqual(INVALID);
    expect(await verify({ header: `${goodHex}00` })).toEqual(INVALID);
    expect(await verify({ header: `${goodHex.slice(0, 63)}g` })).toEqual(INVALID);
    const goodBase64 = nodeHmac("sha256", SECRET, BODY, "base64");
    expect(await verify({ header: goodBase64.slice(0, 40), encoding: "base64" })).toEqual(INVALID);
    expect(await verify({ header: `${goodBase64.slice(0, 42)}*=`, encoding: "base64" })).toEqual(INVALID);
    expect(await verify({ header: `-${goodBase64.slice(1)}`, encoding: "base64" })).toEqual(INVALID);
    expect(await verify({ header: `${goodBase64}==`, encoding: "base64" })).toEqual(INVALID);
  });

  it("refuses a hex signature checked as base64 and a SHA-1 signature checked as SHA-256", async () => {
    expect(await verify({ header: goodHex, encoding: "base64" })).toEqual(INVALID);
    expect(await verify({ header: nodeHmac("sha1", SECRET, BODY, "hex") })).toEqual(INVALID);
  });

  it("refuses several signatures in one header: the format has one", async () => {
    expect(await verify({ header: `${goodHex},${goodHex}` })).toEqual(INVALID);
  });

  it("throws on an algorithm or encoding it does not know: both are configuration bugs", async () => {
    // @ts-expect-error: the test passes values the types already forbid, as JavaScript could.
    await expect(verify({ header: goodHex, algorithm: "md5" })).rejects.toThrow(
      'verifyWebhookSignature: algorithm must be "sha256" or "sha1", got md5',
    );
    // @ts-expect-error: the test passes values the types already forbid, as JavaScript could.
    await expect(verify({ header: goodHex, encoding: "base32" })).rejects.toThrow(
      'verifyWebhookSignature: encoding must be "hex" or "base64", got base32',
    );
  });
});

describe("signWebhookBody", () => {
  it("writes what the provider would send", async () => {
    expect(await signWebhookBody({ secret: SECRET, body: BODY, algorithm: "sha256", encoding: "hex", prefix: "sha256=" })).toBe(
      `sha256=${nodeHmac("sha256", SECRET, BODY, "hex")}`,
    );
    expect(await signWebhookBody({ secret: SECRET, body: BODY, algorithm: "sha256", encoding: "base64" })).toBe(
      nodeHmac("sha256", SECRET, BODY, "base64"),
    );
    expect(await signWebhookBody({ secret: SECRET, body: new TextEncoder().encode(BODY), algorithm: "sha1", encoding: "hex" })).toBe(
      nodeHmac("sha1", SECRET, BODY, "hex"),
    );
  });

  it("round-trips through verifyWebhookSignature", async () => {
    const options = { algorithm: "sha1", encoding: "base64", prefix: "v=" } as const;
    const header = await signWebhookBody({ secret: SECRET, body: BODY, ...options });
    expect(await verifyWebhookSignature({ secret: SECRET, header, body: BODY, ...options })).toEqual({ ok: true, value: undefined });
  });

  it("throws on an empty secret", async () => {
    await expect(signWebhookBody({ secret: "", body: BODY, algorithm: "sha256", encoding: "hex" })).rejects.toThrow(
      "signWebhookBody: the secret must not be empty",
    );
  });
});
