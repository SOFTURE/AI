import { users } from "@softure-ai/auth";
import { createSession, findSessionUser, hashPassword, loginUser, registerUser, type LoginInput } from "@softure-ai/auth/server";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as password from "../src/server/password.js";
import { CLIENT, countRows, createTestAuth, DAY_MS, FAST_SCRYPT, listAttempts, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

vi.mock("../src/server/password.js", { spy: true });

const EMAIL = "ada@example.com";
const LOGIN: LoginInput = { email: " ADA@example.com", password: PASSWORD, clientKey: CLIENT };

describe("loginUser", () => {
  let test: TestAuth;

  async function setUp(options: ConfigOptions = {}): Promise<TestAuth> {
    test = await createTestAuth(options);
    const registered = await registerUser(test.ctx, { email: EMAIL, password: PASSWORD, hasConsented: true, clientKey: "ip:198.51.100.1" });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    vi.clearAllMocks();
    return test;
  }

  afterEach(async () => {
    await test.database.close();
  });

  it("opens a session for the right password, whatever the email's case and spacing", async () => {
    const { ctx } = await setUp();
    const result = await loginUser(ctx, LOGIN);
    if (!result.ok) throw new Error(`login failed with ${result.error}`);
    expect(result.value.user.email).toBe(EMAIL);
    expect(await findSessionUser(ctx, result.value.session.token)).toEqual(result.value.user);
  });

  it("refuses a wrong password and an unknown email with the same code", async () => {
    const { ctx } = await setUp();
    expect(await loginUser(ctx, { ...LOGIN, password: "wrong horse battery" })).toEqual({ ok: false, error: "auth.invalid_credentials" });
    expect(await loginUser(ctx, { ...LOGIN, email: "eve@example.com" })).toEqual({ ok: false, error: "auth.invalid_credentials" });
  });

  it("spends one dummy verification on an unknown email, so it takes as long as a wrong password", async () => {
    const { ctx } = await setUp();
    await loginUser(ctx, { ...LOGIN, email: "eve@example.com" });
    expect(password.verifyDummyPassword).toHaveBeenCalledTimes(1);
    expect(password.verifyDummyPassword).toHaveBeenCalledWith(PASSWORD, FAST_SCRYPT);

    await loginUser(ctx, { ...LOGIN, password: "wrong horse battery" });
    expect(password.verifyDummyPassword).toHaveBeenCalledTimes(1);
    // The wrong password goes through verifyPassword; the dummy calls it inside its own module.
    expect(password.verifyPassword).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an empty email", { email: "  " }],
    ["an empty password", { password: "" }],
    ["a password over 1024 characters", { password: "x".repeat(1025) }],
  ])("refuses %s without hashing", async (_case, change) => {
    const { ctx } = await setUp();
    expect(await loginUser(ctx, { ...LOGIN, ...change })).toEqual({ ok: false, error: "auth.invalid_credentials" });
    expect(password.verifyPassword).not.toHaveBeenCalled();
  });

  it("accepts a valid password of astral characters longer than 1024 UTF-16 units", async () => {
    const { ctx } = await setUp();
    const long = "\u{1F511}".repeat(600);
    const registered = await registerUser(ctx, { email: "emoji@example.com", password: long, hasConsented: true, clientKey: CLIENT });
    expect(registered.ok).toBe(true);
    expect((await loginUser(ctx, { email: "emoji@example.com", password: long, clientKey: CLIENT })).ok).toBe(true);
  });

  it("names the missing buckets when security does not configure them", async () => {
    const { ctx } = await setUp();
    const bare = await createTestAuth({ onlyBuckets: { register: { limit: 5, windowMinutes: 15 } } });
    try {
      await expect(loginUser(bare.ctx, LOGIN)).rejects.toThrow(
        '@softure-ai/auth: security({ buckets }) lacks "login", "login-account", "change-password", "password-reset", "password-reset-account", "password-reset-confirm"; spread AUTH_RATE_LIMIT_BUCKETS into it',
      );
    } finally {
      await bare.database.close();
    }
    expect((await loginUser(ctx, LOGIN)).ok).toBe(true);
  });

  it("counts the login bucket per client before hashing and refuses once it is spent", async () => {
    const { ctx, database } = await setUp({ buckets: { register: { limit: 5, windowMinutes: 15 }, login: { limit: 2, windowMinutes: 15 }, "login-account": { limit: 9, windowMinutes: 15 } } });
    await loginUser(ctx, { ...LOGIN, password: "wrong horse battery" });
    await loginUser(ctx, { ...LOGIN, password: "wrong horse battery" });
    vi.clearAllMocks();
    expect(await loginUser(ctx, LOGIN)).toMatchObject({ ok: false, error: "security.rate_limited" });
    expect(password.verifyPassword).not.toHaveBeenCalled();
    expect(await countRows(database, "sessions")).toBe(1);
  });

  it("counts the login-account bucket per email across client addresses", async () => {
    const { ctx } = await setUp({ buckets: { register: { limit: 5, windowMinutes: 15 }, login: { limit: 50, windowMinutes: 15 }, "login-account": { limit: 3, windowMinutes: 15 } } });
    for (const address of ["192.0.2.1", "192.0.2.2", "192.0.2.3"]) {
      expect(await loginUser(ctx, { ...LOGIN, password: "wrong horse battery", clientKey: `ip:${address}` })).toMatchObject({ error: "auth.invalid_credentials" });
    }
    expect(await loginUser(ctx, { ...LOGIN, clientKey: "ip:192.0.2.4" })).toMatchObject({ ok: false, error: "security.rate_limited" });
  });

  it("forgets the account's failed attempts after a successful login, but not the client's", async () => {
    const { ctx, database } = await setUp();
    await loginUser(ctx, { ...LOGIN, password: "wrong horse battery" });
    expect((await loginUser(ctx, LOGIN)).ok).toBe(true);
    expect(await listAttempts(database)).toEqual(["login ip:192.0.2.10 2", "register ip:198.51.100.1 1"]);
  });

  it("deletes the user's expired sessions at login and keeps the live ones", async () => {
    const { ctx, clock, database } = await setUp();
    const user = (await database.db.select().from(users))[0];
    if (user === undefined) throw new Error("setup: no user");
    clock.advance(31 * DAY_MS);
    await createSession(ctx, user.id);
    expect(await countRows(database, "sessions")).toBe(2);
    expect((await loginUser(ctx, LOGIN)).ok).toBe(true);
    expect(await countRows(database, "sessions")).toBe(2);
  });

  it("rehashes a password stored with another cost", async () => {
    const { ctx, database } = await setUp();
    const older = await hashPassword(PASSWORD, { ...FAST_SCRYPT, cost: 2 ** 11 });
    await database.db.update(users).set({ passwordHash: older }).where(eq(users.email, EMAIL));
    expect((await loginUser(ctx, LOGIN)).ok).toBe(true);
    const [row] = await database.db.select().from(users);
    expect(row?.passwordHash.startsWith("scrypt$1024$8$1$")).toBe(true);
    expect((await loginUser(ctx, LOGIN)).ok).toBe(true);
  });
});
