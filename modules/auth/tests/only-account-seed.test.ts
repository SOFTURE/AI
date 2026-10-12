import { resolveOnlyAccount } from "@softure-ai/auth/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestAuth, PASSWORD, CLIENT, type TestAuth } from "./support.js";
import { registerUser } from "@softure-ai/auth/server";

describe("resolveOnlyAccount", () => {
  let test: TestAuth;

  afterEach(async () => {
    await test.database.close();
  });

  async function register(email: string): Promise<string> {
    const registered = await registerUser(test.ctx, { email, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    return registered.value.user.id;
  }

  it("returns the only account when the variable is not set", async () => {
    test = await createTestAuth();
    const id = await register("ada@example.com");
    expect(await resolveOnlyAccount({ db: test.ctx.db, envName: "SEED_USER_ID", env: {} })).toEqual({ ok: true, value: id });
  });

  it("returns the named account among several, trimming the value", async () => {
    test = await createTestAuth();
    await register("ada@example.com");
    const id = await register("bob@example.com");
    expect(await resolveOnlyAccount({ db: test.ctx.db, envName: "SEED_USER_ID", env: { SEED_USER_ID: ` ${id} ` } })).toEqual({ ok: true, value: id });
  });

  it("refuses an empty database", async () => {
    test = await createTestAuth();
    expect(await resolveOnlyAccount({ db: test.ctx.db, envName: "SEED_USER_ID", env: {} })).toEqual({
      ok: false,
      error: "auth.no_account",
      message: "the database has no account",
    });
  });

  it("refuses several accounts when none is named, never picking the first", async () => {
    test = await createTestAuth();
    await register("ada@example.com");
    await register("bob@example.com");
    expect(await resolveOnlyAccount({ db: test.ctx.db, envName: "SEED_USER_ID", env: { SEED_USER_ID: "  " } })).toEqual({
      ok: false,
      error: "auth.account_ambiguous",
      message: "the database has several accounts; set SEED_USER_ID to the id of the one to use",
    });
  });

  it.each([
    ["a uuid of no account", "8d3f1c2a-1b2c-4d5e-8f90-123456789abc"],
    ["a value that is not a uuid", "ada@example.com"],
  ])("refuses %s", async (_case, value) => {
    test = await createTestAuth();
    await register("ada@example.com");
    expect(await resolveOnlyAccount({ db: test.ctx.db, envName: "SEED_USER_ID", env: { SEED_USER_ID: value } })).toEqual({
      ok: false,
      error: "auth.account_unknown",
      message: "SEED_USER_ID names no account",
    });
  });

  it("reads process.env by default", async () => {
    test = await createTestAuth();
    const id = await register("ada@example.com");
    process.env.ONLY_ACCOUNT_TEST_ID = id;
    try {
      expect(await resolveOnlyAccount({ db: test.ctx.db, envName: "ONLY_ACCOUNT_TEST_ID" })).toEqual({ ok: true, value: id });
    } finally {
      delete process.env.ONLY_ACCOUNT_TEST_ID;
    }
  });
});
