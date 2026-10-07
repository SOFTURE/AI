// The NFC retry must not tell an unknown email from a wrong password by time (issue #156, point 5):
// a wrong non-NFC password costs two derivations with or without an account, any other wrong one costs one.
import { hashPassword, verifyPassword } from "@softure-ai/auth/server";
import * as crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyDummyPassword } from "../src/server/password.js";
import { FAST_SCRYPT } from "./support.js";

vi.mock("node:crypto", { spy: true });

const DECOMPOSED = "café crème brûlée".normalize("NFD");

describe("password verification cost", () => {
  let hash: string;

  beforeEach(async () => {
    hash = await hashPassword("correct horse battery", FAST_SCRYPT);
    // The dummy hash is made once per parameter set; make it before counting.
    await verifyDummyPassword("warm up", FAST_SCRYPT);
    vi.mocked(crypto.scrypt).mockClear();
  });

  it("derives twice for a wrong non-NFC password, against an account and against the dummy", async () => {
    expect(await verifyPassword(DECOMPOSED, hash)).toBe(false);
    expect(crypto.scrypt).toHaveBeenCalledTimes(2);
    vi.mocked(crypto.scrypt).mockClear();
    await verifyDummyPassword(DECOMPOSED, FAST_SCRYPT);
    expect(crypto.scrypt).toHaveBeenCalledTimes(2);
  });

  it("derives once for a wrong NFC password, against an account and against the dummy", async () => {
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
    expect(crypto.scrypt).toHaveBeenCalledTimes(1);
    vi.mocked(crypto.scrypt).mockClear();
    await verifyDummyPassword("correct horse batterY", FAST_SCRYPT);
    expect(crypto.scrypt).toHaveBeenCalledTimes(1);
  });
});
