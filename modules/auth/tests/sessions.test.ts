import { sessions } from "@softure-ai/auth";
import { createSession, findSessionUser, logoutSession, pruneSessions, registerUser, revokeUserSessions } from "@softure-ai/auth/server";
import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, countRows, createTestAuth, DAY_MS, NOW, PASSWORD, type TestAuth } from "./support.js";

describe("sessions", () => {
  let test: TestAuth;
  let userId: string;
  let token: string;

  beforeEach(async () => {
    test = await createTestAuth({ auth: { session: { ttlDays: 7 } } });
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    userId = registered.value.user.id;
    token = registered.value.session.token;
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("finds the user until the configured TTL ends and not after", async () => {
    test.clock.advance(7 * DAY_MS - 1);
    expect((await findSessionUser(test.ctx, token))?.id).toBe(userId);
    test.clock.advance(1);
    expect(await findSessionUser(test.ctx, token)).toBeNull();
  });

  it.each([
    ["an empty token", ""],
    ["a token of the wrong shape", "not a token"],
    ["an unknown token of the right shape", "A".repeat(43)],
  ])("finds nobody for %s", async (_case, candidate) => {
    expect(await findSessionUser(test.ctx, candidate)).toBeNull();
  });

  it("logs out only the given session", async () => {
    const other = await createSession(test.ctx, userId);
    await logoutSession(test.ctx, token);
    expect(await findSessionUser(test.ctx, token)).toBeNull();
    expect((await findSessionUser(test.ctx, other.token))?.id).toBe(userId);
  });

  it("treats logging out an unknown or malformed token as done", async () => {
    await expect(logoutSession(test.ctx, "garbage")).resolves.toBeUndefined();
    await expect(logoutSession(test.ctx, "B".repeat(43))).resolves.toBeUndefined();
    expect(await countRows(test.database, "sessions")).toBe(1);
  });

  it("prunes expired sessions only, and reports how many", async () => {
    test.clock.advance(7 * DAY_MS);
    await createSession(test.ctx, userId);
    expect(await pruneSessions(test.ctx)).toBe(1);
    expect(await countRows(test.database, "sessions")).toBe(1);
    expect(await pruneSessions(test.ctx)).toBe(0);
  });

  it("revokes every session of a user and reports how many", async () => {
    const other = await createSession(test.ctx, userId);
    const bystander = await registerUser(test.ctx, { email: "bo@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!bystander.ok) throw new Error("setup failed");
    expect(await revokeUserSessions(test.ctx, userId)).toBe(2);
    expect(await findSessionUser(test.ctx, token)).toBeNull();
    expect(await findSessionUser(test.ctx, other.token)).toBeNull();
    expect((await findSessionUser(test.ctx, bystander.value.session.token))?.email).toBe("bo@example.com");
    expect(await revokeUserSessions(test.ctx, userId)).toBe(0);
  });

  it("revokes every session but the one it is told to keep", async () => {
    const other = await createSession(test.ctx, userId);
    expect(await revokeUserSessions(test.ctx, userId, { except: token })).toBe(1);
    expect((await findSessionUser(test.ctx, token))?.id).toBe(userId);
    expect(await findSessionUser(test.ctx, other.token)).toBeNull();
  });
});

describe("legacy sessions", () => {
  // An adopted system's tokens: 32 random bytes as 64 hex characters, stored as the sha256 hex of the token.
  const legacyToken = randomBytes(32).toString("hex");
  const legacySession = { cookieName: "session", tokenPattern: /[0-9a-f]{64}/ };

  async function setUp(withLegacy: boolean): Promise<{ test: TestAuth; userId: string }> {
    const test = await createTestAuth({ auth: withLegacy ? { legacySession } : {} });
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error("setup failed");
    const tokenHash = createHash("sha256").update(legacyToken, "utf8").digest("hex");
    await test.database.db.insert(sessions).values({ tokenHash, userId: registered.value.user.id, createdAt: NOW, expiresAt: new Date(NOW.getTime() + DAY_MS) });
    return { test, userId: registered.value.user.id };
  }

  it("finds the user of a legacy token only when the app declares the legacy shape", async () => {
    const without = await setUp(false);
    try {
      expect(await findSessionUser(without.test.ctx, legacyToken)).toBeNull();
    } finally {
      await without.test.database.close();
    }
    const declared = await setUp(true);
    try {
      expect((await findSessionUser(declared.test.ctx, legacyToken))?.id).toBe(declared.userId);
      expect(await findSessionUser(declared.test.ctx, `${legacyToken}0`)).toBeNull();
      expect(await findSessionUser(declared.test.ctx, `x${legacyToken}`)).toBeNull();
      // Twice in a row: the pattern holds no state between lookups.
      expect((await findSessionUser(declared.test.ctx, legacyToken))?.id).toBe(declared.userId);
      await logoutSession(declared.test.ctx, legacyToken);
      expect(await findSessionUser(declared.test.ctx, legacyToken)).toBeNull();
    } finally {
      await declared.test.database.close();
    }
  });
});
