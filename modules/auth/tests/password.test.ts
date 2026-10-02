import { hashPassword, needsRehash, verifyPassword } from "@softure-ai/auth/server";
import { describe, expect, it } from "vitest";
import { FAST_SCRYPT } from "./support.js";

describe("password hashing", () => {
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
});
