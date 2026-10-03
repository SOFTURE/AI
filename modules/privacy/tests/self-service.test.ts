// What a signed-in user does for themselves: the export and the account deletion, each counted per
// user, the deletion behind the current password and an explicit confirmation.
import { AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { createSession, findSessionUser } from "@softure-ai/auth/server";
import { defineSoftureConfig } from "@softure-ai/core";
import { auth } from "@softure-ai/auth";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { deleteOwnAccount, exportOwnData } from "@softure-ai/privacy/server";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestPrivacy, findTraces, PASSWORD, seedUser, type SeededUser, type TestPrivacy } from "./support.js";

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
