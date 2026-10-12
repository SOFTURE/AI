import { loginUser, registerUser, resolveOnlyAccount } from "@softure-ai/auth/server";
import { runSeedAccount, type RunSeedAccountOptions } from "@softure-ai/auth/scripts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, countRows, createTestAuth, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

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

describe("runSeedAccount", () => {
  let test: TestAuth;
  let lines: string[];

  afterEach(async () => {
    await test.database.close();
  });

  async function seed(env: RunSeedAccountOptions["env"]): Promise<number> {
    lines = [];
    const output = { log: (line: string) => lines.push(`log ${line}`), error: (line: string) => lines.push(`error ${line}`) };
    return runSeedAccount({ config: test.config, env, database: test.database.db, output, clock: test.clock });
  }

  async function useFreshDatabase(config: ConfigOptions = {}): Promise<void> {
    test = await createTestAuth(config);
  }

  it("registers the account through the module, runs the hook and leaves no session", async () => {
    const onRegistered = vi.fn();
    await useFreshDatabase({ auth: { onRegistered } });
    const code = await seed({ SEED_EMAIL: "Dev@Example.com", SEED_PASSWORD: PASSWORD });
    expect(code).toBe(0);
    expect(lines).toEqual(["log seed-account: created the account dev@example.com"]);
    expect(onRegistered).toHaveBeenCalledTimes(1);
    expect(await countRows(test.database, "sessions")).toBe(0);
    const login = await loginUser(test.ctx, { email: "dev@example.com", password: PASSWORD, clientKey: CLIENT });
    expect(login.ok).toBe(true);
  });

  it("leaves an existing account as it is on a second run", async () => {
    await useFreshDatabase();
    await seed({ SEED_EMAIL: "dev@example.com", SEED_PASSWORD: PASSWORD });
    const code = await seed({ SEED_EMAIL: "dev@example.com", SEED_PASSWORD: "another long password" });
    expect(code).toBe(0);
    expect(lines).toEqual(["log seed-account: dev@example.com is already there; nothing changed"]);
    expect(await countRows(test.database, "users")).toBe(1);
    const login = await loginUser(test.ctx, { email: "dev@example.com", password: PASSWORD, clientKey: CLIENT });
    expect(login.ok).toBe(true);
  });

  it.each([
    ["no email", { SEED_PASSWORD: PASSWORD }],
    ["no password", { SEED_EMAIL: "dev@example.com", SEED_PASSWORD: " " }],
  ])("is a usage error with %s and writes nothing", async (_case, env) => {
    await useFreshDatabase();
    expect(await seed(env)).toBe(2);
    expect(lines).toEqual(["error seed-account: set SEED_EMAIL and SEED_PASSWORD to the development account's email and password"]);
    expect(await countRows(test.database, "users")).toBe(0);
  });

  it.each([
    ["an invalid email", { SEED_EMAIL: "not-an-email", SEED_PASSWORD: PASSWORD }, "SEED_EMAIL is not a valid email (auth.email_invalid)"],
    ["a short password", { SEED_EMAIL: "dev@example.com", SEED_PASSWORD: "abc12" }, "SEED_PASSWORD is shorter than password.minLength (auth.password_too_short)"],
  ])("refuses %s with a readable reason and never prints the password", async (_case, env, reason) => {
    await useFreshDatabase();
    expect(await seed(env)).toBe(1);
    expect(lines).toEqual([`error seed-account: refused: ${reason}`]);
    expect(lines.join("\n")).not.toContain(env.SEED_PASSWORD);
    expect(await countRows(test.database, "users")).toBe(0);
  });

  it("refuses to run with NODE_ENV=production", async () => {
    await useFreshDatabase();
    expect(await seed({ NODE_ENV: "production", SEED_EMAIL: "dev@example.com", SEED_PASSWORD: PASSWORD })).toBe(1);
    expect(lines).toEqual(["error seed-account: refused: NODE_ENV is production; the seed account is for development"]);
    expect(await countRows(test.database, "users")).toBe(0);
  });

  it("reports a failing hook as a failure, with nothing written", async () => {
    await useFreshDatabase({
      auth: {
        onRegistered: () => {
          throw new Error("profile table is missing");
        },
      },
    });
    expect(await seed({ SEED_EMAIL: "dev@example.com", SEED_PASSWORD: PASSWORD })).toBe(1);
    expect(lines).toEqual(["error seed-account: failed: profile table is missing"]);
    expect(await countRows(test.database, "users")).toBe(0);
  });
});
