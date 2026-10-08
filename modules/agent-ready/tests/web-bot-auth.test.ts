// Web Bot Auth. The oracle is other code than the implementation: Cloudflare's reference library `web-bot-auth` and
// its RFC 9421 core `http-message-sig`. A test of our own signature base would only show the code agrees with itself.
import { verifySignature } from "http-message-sig";
import {
  buildSignatureDirectory,
  createSignedFetch,
  createWebBotAuthKey,
  getDirectorySignatureHeaders,
  getJwkThumbprint,
  getRequestSignatureHeaders,
  readRetiredPublicKeys,
  readWebBotAuthKey,
  signOutgoingRequest,
  verifyDirectorySignature,
  type WebBotAuthKey,
} from "@softure-ai/agent-ready/server";
import { WEB_BOT_AUTH_DIRECTORY_PATH } from "@softure-ai/agent-ready";
import { verify } from "web-bot-auth";
import { verifierFromJWK } from "web-bot-auth/crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

/** The test key of RFC 9421 Appendix B.1.4: a public vector, not a secret. */
const RFC_SEED = "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU";
const RFC_X = "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs";
const AGENT = "https://example.com";
const TARGET = "https://api.example.org/rates/usd?format=json";
const NOW = new Date("2026-10-05T10:00:00Z");
const NONCE = Buffer.alloc(64, 7).toString("base64");

function rfcKey(): WebBotAuthKey {
  const key = createWebBotAuthKey(RFC_SEED);
  if (key === null) throw new Error("the RFC 9421 B.1.4 vector gave no key");
  return key;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the key", () => {
  it("derives the RFC's public key from the RFC 9421 B.1.4 seed", () => {
    expect(rfcKey().publicJwk).toEqual({ kty: "OKP", crv: "Ed25519", x: RFC_X });
  });

  it("uses the RFC 7638 thumbprint as keyid, the one the reference library computes", async () => {
    const key = rfcKey();
    expect(key.keyid).toBe((await verifierFromJWK(key.publicJwk)).keyid);
    expect(getJwkThumbprint(key.publicJwk)).toBe(key.keyid);
    expect(key.keyid).toBe("poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U");
  });

  it("refuses a seed that is not 32 bytes of base64url", () => {
    expect(createWebBotAuthKey("")).toBeNull();
    expect(createWebBotAuthKey("abc")).toBeNull();
    expect(createWebBotAuthKey(`${RFC_SEED}AA`)).toBeNull();
    expect(createWebBotAuthKey("n4Ni+HpISpVObnQMW0wOhCKROaIKqKtW/2ZYb2p9KcU")).toBeNull();
  });

  it("treats an unset variable as no key, without a log line", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(readWebBotAuthKey({})).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it("logs a malformed variable by name, never its value, and reads the configured name", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(readWebBotAuthKey({ SIGNING_SEED: "not-a-key" }, { privateKeyEnv: "SIGNING_SEED" })).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain("SIGNING_SEED");
    expect(String(log.mock.calls[0]?.[0])).not.toContain("not-a-key");
    expect(readWebBotAuthKey({ SIGNING_SEED: RFC_SEED }, { privateKeyEnv: "SIGNING_SEED" })?.keyid).toBe(rfcKey().keyid);
  });

  it("keeps well-formed retired keys and skips the rest with a log line", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(readRetiredPublicKeys({ WEB_BOT_AUTH_RETIRED_PUBLIC_KEYS: ` ${RFC_X} , bad ,` })).toEqual([{ kty: "OKP", crv: "Ed25519", x: RFC_X }]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(readRetiredPublicKeys({})).toEqual([]);
  });
});

describe("the request signature", () => {
  it("is verified by the reference Web Bot Auth library", async () => {
    const key = rfcKey();
    const headers = getRequestSignatureHeaders(TARGET, { key, agentOrigin: AGENT, now: NOW, nonce: NONCE });
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

  it("has the profile's shape: a Signature-Agent dictionary, @authority and signature-agent signed", () => {
    const headers = getRequestSignatureHeaders(TARGET, { key: rfcKey(), agentOrigin: `${AGENT}/`, now: NOW, nonce: NONCE });
    expect(headers["Signature-Agent"]).toBe(`sig1="${AGENT}"`);
    expect(headers["Signature-Input"]).toMatch(
      /^sig1=\("@authority" "signature-agent";key="sig1"\);created=1791194400;keyid="[\w-]{43}";alg="ed25519";expires=1791194700;nonce="[^"]+";tag="web-bot-auth"$/,
    );
    expect(headers.Signature).toMatch(/^sig1=:[A-Za-z0-9+/]{86}==:$/);
  });

  it("fails verification for another host", async () => {
    const key = rfcKey();
    const headers = getRequestSignatureHeaders("https://other.example.org/x", { key, agentOrigin: AGENT, now: NOW, nonce: NONCE });
    const verifier = await verifierFromJWK(key.publicJwk);
    await expect(verify(new Request(TARGET, { headers }), { resolver: () => verifier, now: NOW })).rejects.toThrow();
  });

  it("adds nothing without a key, and three headers with one", () => {
    expect(signOutgoingRequest(TARGET, { agentOrigin: AGENT, env: {} })).toEqual({});
    expect(Object.keys(signOutgoingRequest(TARGET, { agentOrigin: AGENT, env: { WEB_BOT_AUTH_PRIVATE_KEY: RFC_SEED } })).sort()).toEqual([
      "Signature",
      "Signature-Agent",
      "Signature-Input",
    ]);
  });

  it("sends an unparsable URL unsigned instead of throwing", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(signOutgoingRequest("not a url", { agentOrigin: AGENT, env: { WEB_BOT_AUTH_PRIVATE_KEY: RFC_SEED } })).toEqual({});
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe("the signed fetch", () => {
  it("signs every request with a key and keeps the caller's headers", async () => {
    const seen: Headers[] = [];
    const signedFetch = createSignedFetch(
      (_input, init) => {
        seen.push(new Headers(init?.headers));
        return Promise.resolve(new Response("ok"));
      },
      { agentOrigin: AGENT, env: { WEB_BOT_AUTH_PRIVATE_KEY: RFC_SEED } },
    );
    await signedFetch(TARGET, { headers: { accept: "application/json" } });
    expect(seen[0]?.get("accept")).toBe("application/json");
    expect(seen[0]?.get("signature-agent")).toBe(`sig1="${AGENT}"`);
  });

  it("passes the request through untouched without a key, and never throws for the signature", async () => {
    const calls: Array<RequestInit | undefined> = [];
    const plain = createSignedFetch(
      (_input, init) => {
        calls.push(init);
        return Promise.resolve(new Response("ok"));
      },
      { agentOrigin: AGENT, env: {} },
    );
    const init = { method: "POST" };
    await plain(TARGET, init);
    expect(calls[0]).toBe(init);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = createSignedFetch(() => Promise.resolve(new Response("ok")), { agentOrigin: "not an origin", env: { WEB_BOT_AUTH_PRIVATE_KEY: RFC_SEED } });
    await expect(broken(TARGET)).resolves.toBeInstanceOf(Response);
  });
});

describe("the directory", () => {
  it("lists the signing key and the retired ones, each once", () => {
    const key = rfcKey();
    const other = { kty: "OKP" as const, crv: "Ed25519" as const, x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" };
    expect(buildSignatureDirectory(key, [key.publicJwk, other])).toEqual({ keys: [key.publicJwk, other] });
  });

  it("signs the response so the RFC 9421 core verifies it with @authority;req", async () => {
    const key = rfcKey();
    const headers = getDirectorySignatureHeaders("Example.com", { key, now: NOW, nonce: NONCE });
    const verifier = await verifierFromJWK(key.publicJwk);
    const verified = await verifySignature(
      {
        kind: "response",
        status: 200,
        fields: Object.entries(headers).map(([name, value]) => ({ name, value })),
        request: new Request(`${AGENT}${WEB_BOT_AUTH_DIRECTORY_PATH}`),
      },
      {
        policy: { algorithms: ["ed25519"], requiredComponents: [], requiredParameters: ["created", "expires", "keyid", "alg", "tag"], now: Math.floor(NOW.getTime() / 1000) },
        resolveVerifier: (candidate) => {
          expect(candidate.parameters.keyid).toBe(key.keyid);
          return verifier;
        },
      },
    );
    expect(verified.parameters.tag).toBe("http-message-signatures-directory");
    expect(verified.parameters.expires).toBe(Math.floor(NOW.getTime() / 1000) + 3600);
    expect(verified.components).toEqual([{ name: "@authority", parameters: { req: true } }]);
  });

  it("is checked by verifyDirectorySignature the way a verifier does", () => {
    const key = rfcKey();
    const headers = getDirectorySignatureHeaders("example.com", { key, now: NOW, nonce: NONCE });
    const body = buildSignatureDirectory(key);
    const input = { signatureInput: headers["Signature-Input"] ?? null, signature: headers.Signature ?? null, body, now: NOW };
    expect(verifyDirectorySignature({ ...input, authority: "example.com" })).toEqual({ ok: true, detail: `binding0: signed by ${key.keyid} for example.com` });
    expect(verifyDirectorySignature({ ...input, authority: "evil.example" })).toEqual({ ok: false, detail: "binding0: the signature does not verify for evil.example" });
    expect(verifyDirectorySignature({ ...input, authority: "example.com", now: new Date(NOW.getTime() + 7200_000) }).detail).toContain("outside its validity");
    expect(verifyDirectorySignature({ ...input, authority: "example.com", body: { keys: [] } }).detail).toBe("the directory lists no Ed25519 key");
    expect(verifyDirectorySignature({ ...input, authority: "example.com", signature: null }).detail).toBe("no Signature-Input or Signature header");
  });
});
