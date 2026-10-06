import { userRoles, users } from "@softure-ai/auth";
import { findUserRoles, loginUser, verifyPassword } from "@softure-ai/auth/server";
import { createTestAccount } from "@softure-ai/auth/testing";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, countRows, createTestAuth, FAST_SCRYPT, PASSWORD, type TestAuth } from "./support.js";

describe("createTestAccount", () => {
  let test: TestAuth;

  afterEach(async () => {
    await test.database.close();
  });

  async function readStoredHash(email: string): Promise<string> {
    const [row] = await test.ctx.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.email, email));
    if (row === undefined) throw new Error(`no account for ${email}`);
    return row.passwordHash;
  }

  it("writes a user with the normalized email and a hash of the password that login accepts", async () => {
    test = await createTestAuth();
    const before = new Date();
    const account = await createTestAccount(test.ctx.db, { email: " Ada@Example.com ", password: PASSWORD, scrypt: FAST_SCRYPT });

    expect(account.email).toBe("ada@example.com");
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(account.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    const hash = await readStoredHash("ada@example.com");
    expect(hash.startsWith(`scrypt$${String(FAST_SCRYPT.cost)}$8$1$`)).toBe(true);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);

    const login = await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT });
    if (!login.ok) throw new Error(`login failed with ${login.error}`);
    expect(login.value.user).toEqual(account);
    // Same parameters as the app's: the login did not rehash.
    expect(await readStoredHash("ada@example.com")).toBe(hash);
  });

  it("hashes with auth's default cost when no parameters are given", async () => {
    test = await createTestAuth();
    await createTestAccount(test.ctx.db, { email: "ada@example.com", password: PASSWORD });
    expect((await readStoredHash("ada@example.com")).split("$").slice(0, 4)).toEqual(["scrypt", String(2 ** 17), "8", "1"]);
  });

  it("stores the given roles, which findUserRoles returns", async () => {
    test = await createTestAuth({ auth: { roles: ["editor"] } });
    const account = await createTestAccount(test.ctx.db, { email: "ada@example.com", password: PASSWORD, roles: ["admin", "editor"], scrypt: FAST_SCRYPT });
    expect([...(await findUserRoles(test.ctx, account))].sort()).toEqual(["admin", "editor"]);
  });

  it("stores no role rows without roles", async () => {
    test = await createTestAuth();
    const account = await createTestAccount(test.ctx.db, { email: "ada@example.com", password: PASSWORD, scrypt: FAST_SCRYPT });
    expect(await test.ctx.db.select().from(userRoles).where(eq(userRoles.userId, account.id))).toEqual([]);
  });

  it("throws on an invalid email, naming it, and writes nothing", async () => {
    test = await createTestAuth();
    await expect(createTestAccount(test.ctx.db, { email: "not an email", password: PASSWORD, scrypt: FAST_SCRYPT })).rejects.toThrow(
      /createTestAccount: "not an email" is not a valid email/,
    );
    expect(await countRows(test.database, "users")).toBe(0);
  });

  it("throws on a taken email, naming it, and keeps the existing account", async () => {
    test = await createTestAuth();
    const first = await createTestAccount(test.ctx.db, { email: "ada@example.com", password: PASSWORD, scrypt: FAST_SCRYPT });
    await expect(
      createTestAccount(test.ctx.db, { email: "ADA@example.com", password: "another password", roles: ["admin"], scrypt: FAST_SCRYPT }),
    ).rejects.toThrow(/createTestAccount: an account with the email "ada@example.com" already exists/);
    expect(await countRows(test.database, "users")).toBe(1);
    expect(await test.ctx.db.select().from(userRoles).where(eq(userRoles.userId, first.id))).toEqual([]);
  });

  it("rolls the account back when a role is refused by the database", async () => {
    test = await createTestAuth();
    await expect(createTestAccount(test.ctx.db, { email: "ada@example.com", password: PASSWORD, roles: ["Not A Role"], scrypt: FAST_SCRYPT })).rejects.toThrow();
    expect(await countRows(test.database, "users")).toBe(0);
  });
});
