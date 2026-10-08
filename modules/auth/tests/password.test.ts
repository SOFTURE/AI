import { hashPassword, isPasswordHash, needsRehash, verifyPassword } from "@softure-ai/auth/server";
import { describe, expect, it } from "vitest";
import * as password from "../src/server/password.js";
import { FAST_SCRYPT, hashWithoutNormalizing } from "./support.js";

describe("password hashing", () => {
  it("recognises its own hash format and nothing else", async () => {
    const hash = await hashPassword("correct horse battery", FAST_SCRYPT);
    const [, , , , salt, key] = hash.split("$");
    expect(isPasswordHash(hash)).toBe(true);
    for (const value of [
      "",
      "correct horse battery",
      `scrypt$1024$8$1$${String(salt)}`,
      `scrypt$0$8$1$${String(salt)}$${String(key)}`,
      `bcrypt$1024$8$1$${String(salt)}$${String(key)}`,
      `${hash}$extra`,
    ]) {
      expect(isPasswordHash(value), value).toBe(false);
    }
  });

  it("refuses a hash damaged in transport, which would lock the account", async () => {
    const hash = await hashPassword("correct horse battery", FAST_SCRYPT);
    const [, , , , salt = "", key = ""] = hash.split("$");
    const withParts = (parts: { cost?: string; salt?: string; key?: string }): string =>
      ["scrypt", parts.cost ?? "1024", "8", "1", parts.salt ?? salt, parts.key ?? key].join("$");
    expect(withParts({})).toBe(hash);
    const damaged = {
      "last character cut": hash.slice(0, -1),
      "key one character longer": withParts({ key: `${key}A` }),
      "salt one character shorter": withParts({ salt: salt.slice(1) }),
      "padding appended": `${hash}==`,
      "stray + in the key": withParts({ key: `${key.slice(0, 10)}+${key.slice(11)}` }),
      "stray / in the key": withParts({ key: `${key.slice(0, 10)}/${key.slice(11)}` }),
      "stray . in the salt": withParts({ salt: `${salt.slice(0, 5)}.${salt.slice(6)}` }),
      "cost not a power of two": withParts({ cost: "1000" }),
      "cost of 1": withParts({ cost: "1" }),
      "cost past 32 bits, not a power of two": withParts({ cost: String(2 ** 32 + 2 ** 31) }),
    };
    for (const [name, value] of Object.entries(damaged)) {
      expect(isPasswordHash(value), name).toBe(false);
    }
  });

  it("writes a self-describing scrypt hash with a 16-byte salt and a 64-byte key", async () => {
    const hash = await hashPassword("correct horse battery", FAST_SCRYPT);
    const [scheme, cost, blockSize, parallelization, salt, key] = hash.split("$");
    expect([scheme, cost, blockSize, parallelization]).toEqual(["scrypt", "1024", "8", "1"]);
    expect(Buffer.from(salt ?? "", "base64url")).toHaveLength(16);
    expect(Buffer.from(key ?? "", "base64url")).toHaveLength(64);
  });

  it("salts every hash, so equal passwords get different hashes", async () => {
    expect(await hashPassword("same password", FAST_SCRYPT)).not.toBe(await hashPassword("same password", FAST_SCRYPT));
  });

  it("verifies the right password and refuses a wrong one", async () => {
    const hash = await hashPassword("correct horse battery", FAST_SCRYPT);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("treats the composed and decomposed forms of a character as the same password", async () => {
    const composed = "caf\u00e9 cr\u00e8me br\u00fbl\u00e9e";
    const hash = await hashPassword(composed, FAST_SCRYPT);
    expect(await verifyPassword(composed.normalize("NFD"), hash)).toBe(true);
  });

  it("reads the parameters from the hash, so an older cost still verifies", async () => {
    const older = await hashPassword("correct horse battery", { ...FAST_SCRYPT, cost: 2 ** 11 });
    expect(await verifyPassword("correct horse battery", older)).toBe(true);
    expect(needsRehash(older, FAST_SCRYPT)).toBe(true);
    expect(needsRehash(older, { ...FAST_SCRYPT, cost: 2 ** 11 })).toBe(false);
  });

  it.each(["plain-text", "scrypt$1024$8$1$c2FsdA", "scrypt$x$8$1$c2FsdA$a2V5", "bcrypt$1024$8$1$c2FsdA$a2V5", "scrypt$1024$8$1$c2FsdA$a2V5$extra"])(
    "throws on a damaged hash %j without echoing it",
    async (hash) => {
      const error: unknown = await verifyPassword("whatever", hash).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("@softure-ai/auth: a stored password hash is not in the scrypt$N$r$p$salt$key format");
    },
  );

  describe("a legacy hash of input that was not NFC", () => {
    const decomposed = "caf\u00e9 cr\u00e8me br\u00fbl\u00e9e".normalize("NFD");

    it("verifies the same raw input and reports it as a legacy match", async () => {
      const legacy = await hashWithoutNormalizing(decomposed, FAST_SCRYPT);
      expect(await verifyPassword(decomposed, legacy)).toBe(true);
      expect(await password.matchPassword(decomposed, legacy)).toBe("legacy");
      expect(await password.matchPassword("caf\u00e9 wrong", legacy)).toBe("mismatch");
    });

    it("reports a plain match for a hash this module wrote", async () => {
      const hash = await hashPassword(decomposed, FAST_SCRYPT);
      expect(await password.matchPassword(decomposed, hash)).toBe("match");
      expect(await password.matchPassword(decomposed.normalize("NFC"), hash)).toBe("match");
    });
  });
});
