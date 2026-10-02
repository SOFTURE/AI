// The module definition: its manifest, its options and the constraints of its tables.
import { readFileSync } from "node:fs";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { security, headerIp } from "@softure-ai/security";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createTestAuth, NOW, type TestAuth } from "./support.js";

describe("the auth module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(auth));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(auth.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults", () => {
    expect(auth().options).toEqual({
      password: { minLength: 10, scrypt: { cost: 2 ** 17, blockSize: 8, parallelization: 1 } },
      session: { ttlDays: 30 },
      cookie: { name: "softure_session" },
      requireConsent: true,
      registrationClosed: false,
      roles: [],
      adminEmails: [],
      passwordReset: { ttlMinutes: 60 },
    });
  });

  it("refuses options it cannot run with, listing every problem", () => {
    expect(() =>
      auth({
        password: { minLength: 4, scrypt: { cost: 3000 } },
        cookie: { name: "bad name", domain: "Example.COM" },
        // @ts-expect-error: the test passes a value the types already forbid, as a JavaScript config could.
        onRegistered: "store-consent",
        // @ts-expect-error: as above.
        passwordReset: { send: "smtp", ttlMinutes: 1 },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "auth":',
        "- options.password.minLength: Too small: expected number to be >=8",
        "- options.password.scrypt.cost: must be a power of two",
        "- options.cookie.name: must be 1-64 letters, digits, _ or -",
        "- options.cookie.domain: must be a lowercase host name such as example.com",
        "- options.passwordReset.send: must be a function",
        "- options.passwordReset.ttlMinutes: Too small: expected number to be >=5",
        "- options.onRegistered: must be a function",
      ].join("\n"),
    );
  });

  it("needs the security module in the app configuration", () => {
    expect(() => createConfig({ buckets: AUTH_RATE_LIMIT_BUCKETS })).not.toThrow();
    expect(() =>
      defineSoftureConfig({ database: { url: "pglite://" }, locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [auth()] }),
    ).toThrow('module "auth" needs module "security" (^0.0.0), which is not listed');
  });

  it("lists security before auth when sorting, so its migrations run first", () => {
    const config = createConfig();
    expect(config.modules.map((module) => module.id)).toEqual(["security", "auth"]);
  });
});

describe("auth tables constraints", () => {
  let test: TestAuth;

  beforeEach(async () => {
    test = await createTestAuth();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function insertUser(email: string, passwordHash = "scrypt$1$8$1$c2FsdA$a2V5"): Promise<string> {
    const result = await test.database.client.query<{ id: string }>(
      "INSERT INTO auth.users (email, password_hash, created_at, password_changed_at) VALUES ($1, $2, $3, $3) RETURNING id",
      [email, passwordHash, NOW],
    );
    return result.rows[0]?.id ?? "";
  }

  it("accepts a lowercase email and generates the id", async () => {
    expect(await insertUser("ada@example.com")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ["an uppercase email", "Ada@example.com", undefined],
    ["an email with spaces around it", " ada@example.com", undefined],
    ["a password hash that is not scrypt", "ada@example.com", "plain-text"],
  ])("rejects %s", async (_case, email, hash) => {
    await expect(insertUser(email, hash)).rejects.toThrow(/check constraint/);
  });

  it("rejects a second account with the same email", async () => {
    await insertUser("ada@example.com");
    await expect(insertUser("ada@example.com")).rejects.toThrow(/duplicate key/);
  });

  it("rejects a session hash that is not sha256 hex and one that expires before it starts", async () => {
    const userId = await insertUser("ada@example.com");
    const insert = (hash: string, expiresAt: Date) =>
      test.database.client.query("INSERT INTO auth.sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)", [
        hash,
        userId,
        NOW,
        expiresAt,
      ]);
    await expect(insert("not-a-hash", new Date(NOW.getTime() + 1000))).rejects.toThrow(/check constraint/);
    await expect(insert("a".repeat(64), NOW)).rejects.toThrow(/check constraint/);
    await expect(insert("a".repeat(64), new Date(NOW.getTime() + 1000))).resolves.toBeDefined();
  });

  it("rejects a reset token hash that is not sha256 hex, a reused hash and one that expires before it starts", async () => {
    const userId = await insertUser("ada@example.com");
    const otherId = await insertUser("bo@example.com");
    const insert = (user: string, hash: string, expiresAt: Date) =>
      test.database.client.query("INSERT INTO auth.password_resets (user_id, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4)", [
        user,
        hash,
        NOW,
        expiresAt,
      ]);
    await expect(insert(userId, "not-a-hash", new Date(NOW.getTime() + 1000))).rejects.toThrow(/check constraint/);
    await expect(insert(userId, "c".repeat(64), NOW)).rejects.toThrow(/check constraint/);
    await expect(insert(userId, "c".repeat(64), new Date(NOW.getTime() + 1000))).resolves.toBeDefined();
    await expect(insert(userId, "d".repeat(64), new Date(NOW.getTime() + 1000))).rejects.toThrow(/duplicate key/);
    await expect(insert(otherId, "c".repeat(64), new Date(NOW.getTime() + 1000))).rejects.toThrow(/duplicate key/);
  });

  it("deletes a user's sessions with the user", async () => {
    const userId = await insertUser("ada@example.com");
    await test.database.client.query("INSERT INTO auth.sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)", [
      "b".repeat(64),
      userId,
      NOW,
      new Date(NOW.getTime() + 1000),
    ]);
    await test.database.client.query("DELETE FROM auth.users WHERE id = $1", [userId]);
    const result = await test.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM auth.sessions");
    expect(result.rows[0]?.count).toBe(0);
  });
});

describe("the auth health check", () => {
  it("passes once the tables exist", async () => {
    const test = await createTestAuth();
    try {
      expect(await auth().health?.(test.ctx)).toEqual({ ok: true, value: undefined });
    } finally {
      await test.database.close();
    }
  });

  it("throws without the auth tables, so the health route reports auth as failing", async () => {
    const test = await createTestAuth();
    try {
      await test.database.client.query("DROP SCHEMA auth CASCADE");
      await expect(auth().health?.(test.ctx)).rejects.toThrow(/auth\.users/);
    } finally {
      await test.database.close();
    }
  });

  it("throws without the password resets table", async () => {
    const test = await createTestAuth();
    try {
      await test.database.client.query("DROP TABLE auth.password_resets");
      await expect(auth().health?.(test.ctx)).rejects.toThrow(/auth\.password_resets/);
    } finally {
      await test.database.close();
    }
  });

  it("throws without the roles table", async () => {
    const test = await createTestAuth();
    try {
      await test.database.client.query("DROP TABLE auth.user_roles");
      await expect(auth().health?.(test.ctx)).rejects.toThrow(/auth\.user_roles/);
    } finally {
      await test.database.close();
    }
  });
});

describe("the default buckets", () => {
  it("are valid security buckets", () => {
    expect(() => security({ clientIp: headerIp("x-real-ip"), buckets: AUTH_RATE_LIMIT_BUCKETS })).not.toThrow();
  });
});
