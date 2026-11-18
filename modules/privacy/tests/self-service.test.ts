// What a signed-in user does for themselves: the export and the account deletion, each counted per
// user, the deletion behind the current password and an explicit confirmation.
import { AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { createSession, findSessionUser } from "@softure-ai/auth/server";
import { defineSoftureConfig } from "@softure-ai/core";
import { auth } from "@softure-ai/auth";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { deleteOwnAccount, exportOwnData, getDeletionReauthentication } from "@softure-ai/privacy/server";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createTestPrivacy, findTraces, PASSWORD, profileContributor, seedUser, type SeededUser, type TestPrivacy } from "./support.js";

describe("self-service privacy", () => {
  let test: TestPrivacy;
  let ada: SeededUser;

  beforeEach(async () => {
    test = await createTestPrivacy();
    ada = await seedUser(test, "ada@example.com");
  });
  afterEach(async () => {
    await test.database.close();
  });

  describe("deleteOwnAccount", () => {
    it("deletes the account and its data, and ends every session", async () => {
      const other = await createSession(test.ctx, ada.id);
      expect(await deleteOwnAccount(test.ctx, { userId: ada.id, password: PASSWORD, isConfirmed: true })).toEqual({ ok: true, value: undefined });
      expect(await findSessionUser(test.ctx, other.token)).toBeNull();
      expect(await findTraces(test.database, [ada.id, ada.email])).toEqual([]);
    });

    it("needs the confirmation, and does not count an attempt without it", async () => {
      expect(await deleteOwnAccount(test.ctx, { userId: ada.id, password: PASSWORD, isConfirmed: false })).toEqual({
        ok: false,
        error: "privacy.confirmation_required",
      });
      const attempts = await test.database.client.query("SELECT 1 FROM security.rate_limits WHERE bucket = 'privacy-delete'");
      expect(attempts.rows).toEqual([]);
      expect(await findTraces(test.database, [ada.id])).toContain("auth.users.id");
    });

    it("needs the current password", async () => {
      expect(await deleteOwnAccount(test.ctx, { userId: ada.id, password: "not my password", isConfirmed: true })).toEqual({
        ok: false,
        error: "privacy.password_invalid",
      });
      expect(await findTraces(test.database, [ada.id])).toContain("auth.users.id");
    });

    it("stops after five attempts per user, even with the right password", async () => {
      for (let attempt = 0; attempt < PRIVACY_RATE_LIMIT_BUCKETS["privacy-delete"].limit; attempt++) {
        await deleteOwnAccount(test.ctx, { userId: ada.id, password: "guess", isConfirmed: true });
      }
      const result = await deleteOwnAccount(test.ctx, { userId: ada.id, password: PASSWORD, isConfirmed: true });
      expect(result).toMatchObject({ ok: false, error: "security.rate_limited", retryAfterSeconds: 15 * 60 });
      expect(await findTraces(test.database, [ada.id])).toContain("auth.users.id");
    });

    it("stores no user id or email in the rate limit table", async () => {
      await deleteOwnAccount(test.ctx, { userId: ada.id, password: "guess", isConfirmed: true });
      expect(await findTraces(test.database, [ada.id, ada.email])).not.toContain("security.rate_limits.identifier");
    });
  });

  describe("exportOwnData", () => {
    it("returns the user's export", async () => {
      const result = await exportOwnData(test.ctx, { userId: ada.id });
      expect(result.ok && result.value.document.userId).toBe(ada.id);
    });

    it("stops after five downloads an hour per user", async () => {
      for (let attempt = 0; attempt < PRIVACY_RATE_LIMIT_BUCKETS["privacy-export"].limit; attempt++) {
        expect((await exportOwnData(test.ctx, { userId: ada.id })).ok).toBe(true);
      }
      expect(await exportOwnData(test.ctx, { userId: ada.id })).toMatchObject({ ok: false, error: "security.rate_limited" });
    });
  });

  it("names the missing buckets when security lacks them", async () => {
    const config = defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "UTC",
      appOrigin: "http://localhost:3000",
      modules: [security({ clientIp: headerIp("x-real-ip"), buckets: AUTH_RATE_LIMIT_BUCKETS }), auth(), privacy()],
    });
    const ctx = { ...test.ctx, config };
    await expect(exportOwnData(ctx, { userId: ada.id })).rejects.toThrow(
      '@softure-ai/privacy: security({ buckets }) lacks "privacy-export", "privacy-delete"; spread PRIVACY_RATE_LIMIT_BUCKETS into it',
    );
  });
});

describe("deleteOwnAccount with a provider sign-in instead of the password", () => {
  let test: TestPrivacy;
  let ada: SeededUser;

  beforeEach(async () => {
    test = await createTestPrivacy();
    ada = await seedUser(test, "ada@example.com");
  });
  afterEach(async () => {
    await test.database.close();
  });

  /** Ada signs in with a provider now: the identity is stamped, then the session opens, as the callback does. */
  async function signInWithProvider(): Promise<string> {
    await test.database.client.query(
      `INSERT INTO auth.identities (provider, subject, user_id, email, created_at, last_login_at) VALUES ('github', 'sub-ada', $1, $2, $3, $3)
       ON CONFLICT (provider, subject) DO UPDATE SET last_login_at = EXCLUDED.last_login_at`,
      [ada.id, ada.email, test.clock.now()],
    );
    return (await createSession(test.ctx, ada.id)).token;
  }

  it("deletes the account right after a provider sign-in opened this session, without a password", async () => {
    const sessionToken = await signInWithProvider();
    test.clock.advance(5 * 60 * 1000);
    expect(await deleteOwnAccount(test.ctx, { userId: ada.id, sessionToken, isConfirmed: true })).toEqual({ ok: true, value: undefined });
    expect(await findTraces(test.database, [ada.id, ada.email])).toEqual([]);
  });

  it("refuses once the sign-in is older than deletion.recentSignInMinutes", async () => {
    const sessionToken = await signInWithProvider();
    test.clock.advance(10 * 60 * 1000 + 1);
    expect(await deleteOwnAccount(test.ctx, { userId: ada.id, sessionToken, isConfirmed: true })).toEqual({
      ok: false,
      error: "privacy.reauthentication_required",
    });
    expect(await findTraces(test.database, [ada.id])).toContain("auth.users.id");
  });

  it("takes the window from the options", async () => {
    test = await createTestPrivacy(createConfig({ contributors: [profileContributor], deletion: { recentSignInMinutes: 30 } }));
    ada = await seedUser(test, "ada@example.com");
    const sessionToken = await signInWithProvider();
    test.clock.advance(20 * 60 * 1000);
    expect((await deleteOwnAccount(test.ctx, { userId: ada.id, sessionToken, isConfirmed: true })).ok).toBe(true);
  });

  it("refuses a session that a password login opened, and a missing session", async () => {
    await signInWithProvider();
    test.clock.advance(60 * 1000 + 1);
    const passwordSession = await createSession(test.ctx, ada.id);
    expect(await deleteOwnAccount(test.ctx, { userId: ada.id, sessionToken: passwordSession.token, isConfirmed: true })).toEqual({
      ok: false,
      error: "privacy.reauthentication_required",
    });
    expect(await deleteOwnAccount(test.ctx, { userId: ada.id, password: "", isConfirmed: true })).toEqual({
      ok: false,
      error: "privacy.reauthentication_required",
    });
    expect(await findTraces(test.database, [ada.id])).toContain("auth.users.id");
  });

  it("checks a typed password even after a provider sign-in", async () => {
    const sessionToken = await signInWithProvider();
    expect(await deleteOwnAccount(test.ctx, { userId: ada.id, password: "not my password", sessionToken, isConfirmed: true })).toEqual({
      ok: false,
      error: "privacy.password_invalid",
    });
  });

  it("tells the form which providers the account has and which one confirms now", async () => {
    expect(await getDeletionReauthentication(test.ctx, { userId: ada.id, sessionToken: null })).toEqual({ linkedProviders: [], recentProvider: null });
    const sessionToken = await signInWithProvider();
    expect(await getDeletionReauthentication(test.ctx, { userId: ada.id, sessionToken })).toEqual({ linkedProviders: ["github"], recentProvider: "github" });
    test.clock.advance(11 * 60 * 1000);
    expect(await getDeletionReauthentication(test.ctx, { userId: ada.id, sessionToken })).toEqual({ linkedProviders: ["github"], recentProvider: null });
  });
});
