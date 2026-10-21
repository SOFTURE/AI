// The keyring and the sealing of secrets: AES-256-GCM, the key id in every ciphertext, the row bound as
// additional data, and failures as codes that never quote a key.
import { generateConnectionsKey, openSecret, readKeyring, sealSecret } from "@softure-ai/connections/server";
import { createTestKeyring } from "@softure-ai/connections/testing";
import { describe, expect, it } from "vitest";

function keyringOf(ids: readonly string[]) {
  const keyring = readKeyring(createTestKeyring(ids));
  if (!keyring.ok) throw new Error(`test: keyring refused with ${keyring.error}`);
  return keyring.value;
}

describe("readKeyring", () => {
  it("reads every key and seals with the first one", () => {
    const keyring = keyringOf(["new", "old"]);
    expect(keyring.current.id).toBe("new");
    expect([...keyring.keys.keys()]).toEqual(["new", "old"]);
  });

  it("takes standard and URL-safe base64, with spaces around entries", () => {
    const key = Buffer.alloc(32, 251);
    const keyring = readKeyring({ SOFTURE_CONNECTIONS_KEYS: ` a:${key.toString("base64")} , b:${key.toString("base64url")} ` });
    expect(keyring.ok && keyring.value.keys.get("a")?.equals(key) && keyring.value.keys.get("b")?.equals(key)).toBe(true);
  });

  it.each([
    ["unset", undefined, "connections.key_missing"],
    ["empty", "  ", "connections.key_missing"],
    ["without an id", Buffer.alloc(32).toString("base64"), "connections.key_invalid"],
    ["with a short key", `a:${Buffer.alloc(16).toString("base64")}`, "connections.key_invalid"],
    ["with a repeated id", `a:${Buffer.alloc(32).toString("base64")},a:${Buffer.alloc(32, 1).toString("base64")}`, "connections.key_invalid"],
    ["with an id holding a dot", `a.b:${Buffer.alloc(32).toString("base64")}`, "connections.key_invalid"],
    ["with an empty entry", `a:${Buffer.alloc(32).toString("base64")},`, "connections.key_invalid"],
  ])("refuses a keyring %s", (_case, value, code) => {
    expect(readKeyring({ SOFTURE_CONNECTIONS_KEYS: value })).toEqual({ ok: false, error: code });
  });
});

describe("generateConnectionsKey", () => {
  it("makes a fresh entry the keyring reads", () => {
    const first = generateConnectionsKey("k1");
    expect(first).toMatch(/^k1:[A-Za-z0-9_-]{43}$/);
    expect(generateConnectionsKey("k1")).not.toBe(first);
    expect(readKeyring({ SOFTURE_CONNECTIONS_KEYS: first }).ok).toBe(true);
    expect(generateConnectionsKey()).toMatch(/^\d{8}:/);
  });

  it("refuses an id the keyring would not read", () => {
    expect(() => generateConnectionsKey("a:b")).toThrow(RangeError);
  });
});

describe("sealSecret and openSecret", () => {
  const keyring = keyringOf(["k2", "k1"]);

  it("round-trips a secret and names its key, with a new IV every time", () => {
    const first = sealSecret(keyring, "token-123", "row-a");
    const second = sealSecret(keyring, "token-123", "row-a");
    expect(first.keyId).toBe("k2");
    expect(first.sealed.startsWith("v1.k2.")).toBe(true);
    expect(first.sealed).not.toContain("token-123");
    expect(first.sealed).not.toBe(second.sealed);
    expect(openSecret(keyring, first.sealed, "row-a")).toEqual({ ok: true, value: "token-123" });
  });

  it("opens a secret sealed with an older key while the keyring holds it", () => {
    const old = sealSecret(keyringOf(["k1"]), "token-old", "row-a");
    expect(openSecret(keyring, old.sealed, "row-a")).toEqual({ ok: true, value: "token-old" });
    expect(openSecret(keyringOf(["k3"]), old.sealed, "row-a")).toEqual({ ok: false, error: "connections.key_unknown" });
  });

  it("refuses a secret moved to another row, tampered with or malformed", () => {
    const { sealed } = sealSecret(keyring, "token-123", "row-a");
    expect(openSecret(keyring, sealed, "row-b")).toEqual({ ok: false, error: "connections.secret_unreadable" });
    const parts = sealed.split(".");
    const body = Buffer.from(parts[3] ?? "", "base64url");
    body[0] = (body[0] ?? 0) ^ 1;
    expect(openSecret(keyring, [parts[0], parts[1], parts[2], body.toString("base64url")].join("."), "row-a")).toEqual({
      ok: false,
      error: "connections.secret_unreadable",
    });
    for (const broken of ["", "v2.k2.a.b", "v1.k2.a", `${sealed}.extra`, "v1.k2.AAAA.AAAA"]) {
      expect(openSecret(keyring, broken, "row-a"), broken).toEqual({ ok: false, error: "connections.secret_unreadable" });
    }
  });
});
