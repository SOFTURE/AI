// The oracle is other code than the implementation: Cloudflare's reference library `web-bot-auth`. A test of our own
// signature base would only show the code agrees with itself.
import { verify } from "web-bot-auth";
import { verifierFromJWK } from "web-bot-auth/crypto";
import { describe, expect, it } from "vitest";
import { getWebBotAuthHeaders, readWebBotAuthKey, type WebBotAuthKey } from "./web-bot-auth.js";

/** The test key of RFC 9421 Appendix B.1.4: a public vector, not a secret. */
const RFC_SEED = "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU";
const RFC_X = "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs";
const AGENT = "https://example.com";
const TARGET = "https://api.example.org/rates/usd?format=json";
const NOW = new Date("2026-10-05T10:00:00Z");
const NONCE = Buffer.alloc(64, 7).toString("base64");

function rfcKey(): WebBotAuthKey {
  const read = readWebBotAuthKey({ SEED: RFC_SEED }, "SEED");
  if (!read.ok) throw new Error(read.reason);
  return read.key;
}

describe("readWebBotAuthKey", () => {
  it("derives the RFC 9421 B.1.4 public key and the reference library's keyid", async () => {
    const key = rfcKey();
    expect(key.publicJwk).toEqual({ kty: "OKP", crv: "Ed25519", x: RFC_X });
    expect(key.keyid).toBe((await verifierFromJWK(key.publicJwk)).keyid);
    expect(key.keyid).toBe("poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U");
  });

  it("names an unset or empty variable", () => {
    expect(readWebBotAuthKey({}, "BOT_SEED")).toEqual({ ok: false, reason: "BOT_SEED is not set" });
    expect(readWebBotAuthKey({ BOT_SEED: "" }, "BOT_SEED")).toEqual({ ok: false, reason: "BOT_SEED is not set" });
  });

  it("names a malformed variable and never repeats its value", () => {
    for (const value of ["not-a-key", `${RFC_SEED}AA`, "n4Ni+HpISpVObnQMW0wOhCKROaIKqKtW/2ZYb2p9KcU"]) {
      const read = readWebBotAuthKey({ BOT_SEED: value }, "BOT_SEED");
      expect(read).toEqual({ ok: false, reason: "BOT_SEED is not a base64url Ed25519 seed (32 bytes)" });
    }
  });
});

describe("getWebBotAuthHeaders", () => {
  it("signs a request the reference library verifies, for the request's own authority", async () => {
    const key = rfcKey();
    const headers = getWebBotAuthHeaders(TARGET, { key, agentOrigin: AGENT, now: NOW, nonce: NONCE });
    const verifier = await verifierFromJWK(key.publicJwk);
    const result = await verify(new Request(TARGET, { headers }), {
      resolver: (candidate) => {
        expect(candidate.keyid).toBe(key.keyid);
        return verifier;
      },
      now: NOW,
    });
    expect(result.tag).toBe("web-bot-auth");
    expect(result.nonce).toBe(NONCE);
    expect(result.signatureAgent).toEqual({ label: "sig1", uri: AGENT, type: "directory" });
    expect(result.expires.getTime() - result.created.getTime()).toBe(300_000);
  });

  it("does not verify for another authority", async () => {
    const key = rfcKey();
    const headers = getWebBotAuthHeaders("https://other.example.org/x", { key, agentOrigin: AGENT, now: NOW, nonce: NONCE });
    const verifier = await verifierFromJWK(key.publicJwk);
    await expect(verify(new Request(TARGET, { headers }), { resolver: () => verifier, now: NOW })).rejects.toThrow();
  });

  it("uses a fresh 64-byte nonce per request by default", () => {
    const key = rfcKey();
    const first = getWebBotAuthHeaders(TARGET, { key, agentOrigin: AGENT });
    const second = getWebBotAuthHeaders(TARGET, { key, agentOrigin: AGENT });
    const nonceOf = (input: string | undefined) => /;nonce="([^"]+)"/.exec(input ?? "")?.[1] ?? "";
    expect(Buffer.from(nonceOf(first["signature-input"]), "base64")).toHaveLength(64);
    expect(nonceOf(first["signature-input"])).not.toBe(nonceOf(second["signature-input"]));
  });
});
