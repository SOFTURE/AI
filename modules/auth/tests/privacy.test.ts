// The auth contributor to GDPR exports and deletions, and the password check before a deletion.
import { auth } from "@softure-ai/auth";
import { createSession, deleteAuthUserData, exportAuthUserData, isCurrentPassword, registerUser } from "@softure-ai/auth/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestAuth, NOW, PASSWORD, type TestAuth } from "./support.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("the auth privacy contributor", () => {
  let test: TestAuth;
  let adaId: string;
  let bobId: string;

  async function register(email: string): Promise<string> {
    const result = await registerUser(test.ctx, { email, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!result.ok) throw new Error(result.error);
    return result.value.user.id;
  }

  async function countUserRows(userId: string): Promise<Record<string, number>> {
    const result = await test.database.client.query<{ name: string; count: number }>(
      `SELECT 'users' AS name, count(*)::int AS count FROM auth.users WHERE id = $1
       UNION ALL SELECT 'sessions', count(*)::int FROM auth.sessions WHERE user_id = $1
       UNION ALL SELECT 'user_roles', count(*)::int FROM auth.user_roles WHERE user_id = $1
       UNION ALL SELECT 'password_resets', count(*)::int FROM auth.password_resets WHERE user_id = $1`,
      [userId],
    );
    return Object.fromEntries(result.rows.map((row) => [row.name, row.count]));
  }

  beforeEach(async () => {
    test = await createTestAuth();
    adaId = await register("ada@example.com");
    bobId = await register("bob@example.com");
    for (const id of [adaId, bobId]) {
      await test.database.client.query("INSERT INTO auth.user_roles (user_id, role, granted_at) VALUES ($1, 'admin', $2)", [id, NOW]);
      await test.database.client.query("INSERT INTO auth.password_resets (user_id, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4)", [
        id,
        id.replaceAll("-", "").padEnd(64, "0"),
        NOW,
        new Date(NOW.getTime() + 3_600_000),
      ]);
    }
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("is registered with the module, as its manifest promises", () => {
    expect(auth.manifest.privacy).toEqual({ exports: true, deletes: true });
    expect(auth().privacy?.exportUserData).toBe(exportAuthUserData);
    expect(auth().privacy?.deleteUserData).toBe(deleteAuthUserData);
  });

  it("exports the account, its roles, sessions and pending reset, without any hash", async () => {
    const result = await exportAuthUserData(test.ctx, adaId);
    expect(result).toEqual({
      ok: true,
      value: {
        account: { id: adaId, email: "ada@example.com", createdAt: NOW, passwordChangedAt: NOW },
        roles: [{ role: "admin", grantedAt: NOW }],
        sessions: [{ createdAt: NOW, expiresAt: new Date(NOW.getTime() + 30 * 24 * 3_600_000) }],
        passwordReset: { createdAt: NOW, expiresAt: new Date(NOW.getTime() + 3_600_000) },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/scrypt\$|[0-9a-f]{64}/);
  });

  it("exports nothing for an unknown account or an id that is not a UUID", async () => {
    const empty = { ok: true, value: { account: null, roles: [], sessions: [], passwordReset: null } };
    expect(await exportAuthUserData(test.ctx, UNKNOWN_ID)).toEqual(empty);
    expect(await exportAuthUserData(test.ctx, "not-a-uuid")).toEqual(empty);
  });

  it("deletes the account with its sessions, roles and reset link, and nothing of another account", async () => {
    await createSession(test.ctx, adaId);
    expect(await deleteAuthUserData(test.ctx, adaId)).toEqual({ ok: true, value: undefined });
    expect(await countUserRows(adaId)).toEqual({ users: 0, sessions: 0, user_roles: 0, password_resets: 0 });
    expect(await countUserRows(bobId)).toEqual({ users: 1, sessions: 1, user_roles: 1, password_resets: 1 });
  });

  it("deletes nothing for an id that is not a UUID", async () => {
    expect(await deleteAuthUserData(test.ctx, "not-a-uuid")).toEqual({ ok: true, value: undefined });
    expect(await countUserRows(adaId)).toEqual({ users: 1, sessions: 1, user_roles: 1, password_resets: 1 });
  });
});

describe("isCurrentPassword", () => {
  let test: TestAuth;

  beforeEach(async () => {
    test = await createTestAuth();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("is true only for the account's current password", async () => {
    const result = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!result.ok) throw new Error(result.error);
    expect(await isCurrentPassword(test.ctx, result.value.user.id, PASSWORD)).toBe(true);
    expect(await isCurrentPassword(test.ctx, result.value.user.id, `${PASSWORD} `)).toBe(false);
  });

  it("is false for an unknown account", async () => {
    expect(await isCurrentPassword(test.ctx, UNKNOWN_ID, PASSWORD)).toBe(false);
  });
});
