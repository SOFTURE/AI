import { consolePasswordResetSender, type AuthUser, type PasswordResetDetails } from "@softure-ai/auth";
import {
  changePassword,
  createSession,
  deliverPasswordReset,
  findPasswordResetUser,
  findSessionUser,
  getPasswordResetLink,
  isPasswordResetEnabled,
  loginUser,
  prunePasswordResets,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "@softure-ai/auth/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT, countRows, createTestAuth, listAttempts, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

const EMAIL = "ada@example.com";
const NEW_PASSWORD = "a brand new passphrase";
const MINUTE_MS = 60 * 1000;

interface SentLink {
  readonly link: string;
  readonly user: AuthUser;
  readonly details: PasswordResetDetails;
}

describe("password reset", () => {
  let test: TestAuth;
  let sent: SentLink[];
  let userId: string;

  function recordLink(link: string, user: AuthUser, details: PasswordResetDetails): Promise<void> {
    sent.push({ link, user, details });
    return Promise.resolve();
  }

  async function setUp(options: ConfigOptions = {}): Promise<void> {
    sent = [];
    test = await createTestAuth({ ...options, auth: { passwordReset: { send: recordLink }, ...options.auth } });
    const registered = await registerUser(test.ctx, { email: EMAIL, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    userId = registered.value.user.id;
  }

  /** Issues a link through the public flow and returns its token. */
  async function issueToken(): Promise<string> {
    expect(await deliverPasswordReset(test.ctx, EMAIL)).toBe("sent");
    const token = new URL(sent.at(-1)?.link ?? "").searchParams.get("token");
    if (token === null) throw new Error("the sent link has no token");
    return token;
  }

  beforeEach(async () => {
    await setUp();
  });
  afterEach(async () => {
    await test.database.close();
  });

  describe("requestPasswordReset", () => {
    it("accepts a known and an unknown email alike, normalized, without looking them up", async () => {
      expect(await requestPasswordReset(test.ctx, { email: "  ADA@example.com ", clientKey: CLIENT })).toEqual({ ok: true, value: { email: EMAIL } });
      expect(await requestPasswordReset(test.ctx, { email: "nobody@example.com", clientKey: CLIENT })).toEqual({
        ok: true,
        value: { email: "nobody@example.com" },
      });
      expect(sent).toEqual([]);
    });

    it("refuses an email that is not one", async () => {
      expect(await requestPasswordReset(test.ctx, { email: "not-an-email", clientKey: CLIENT })).toEqual({ ok: false, error: "auth.email_invalid" });
    });

    it("counts password-reset per client and password-reset-account per email, for unknown emails too", async () => {
      await requestPasswordReset(test.ctx, { email: EMAIL, clientKey: CLIENT });
      await requestPasswordReset(test.ctx, { email: "nobody@example.com", clientKey: CLIENT });
      expect(await listAttempts(test.database)).toEqual([
        "password-reset ip:192.0.2.10 2",
        expect.stringMatching(/^password-reset-account subject:[0-9a-f]{32} 1$/) as string,
        expect.stringMatching(/^password-reset-account subject:[0-9a-f]{32} 1$/) as string,
        "register ip:192.0.2.10 1",
      ]);
    });

    it("refuses once an email's bucket is spent, whether or not it has an account", async () => {
      for (const email of [EMAIL, "nobody@example.com"]) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          expect((await requestPasswordReset(test.ctx, { email, clientKey: `ip:192.0.2.${String(20 + attempt)}` })).ok).toBe(true);
        }
        expect(await requestPasswordReset(test.ctx, { email, clientKey: "ip:192.0.2.99" })).toMatchObject({ ok: false, error: "security.rate_limited" });
      }
    });

    it("refuses once a client's bucket is spent, before checking the email", async () => {
      await test.database.close();
      await setUp({ buckets: { "password-reset": { limit: 1, windowMinutes: 15 } } });
      expect((await requestPasswordReset(test.ctx, { email: EMAIL, clientKey: CLIENT })).ok).toBe(true);
      expect(await requestPasswordReset(test.ctx, { email: "not-an-email", clientKey: CLIENT })).toMatchObject({
        ok: false,
        error: "security.rate_limited",
      });
    });
  });

  describe("deliverPasswordReset", () => {
    it("sends a link on appOrigin with a token, the user and the expiry", async () => {
      expect(await deliverPasswordReset(test.ctx, EMAIL)).toBe("sent");
      expect(sent).toHaveLength(1);
      const [message] = sent;
      expect(message?.link).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=[A-Za-z0-9_-]{43}$/);
      expect(message?.user).toEqual({ id: userId, email: EMAIL, createdAt: NOW });
      expect(message?.details).toEqual({ expiresAt: new Date(NOW.getTime() + 60 * MINUTE_MS), locale: "en" });
    });

    it("stores only the token's sha256", async () => {
      const token = await issueToken();
      const rows = await test.database.client.query<{ token_hash: string }>("SELECT token_hash FROM auth.password_resets");
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(rows.rows[0]?.token_hash).not.toContain(token);
    });

    it("sends nothing and stores nothing for an unknown email", async () => {
      expect(await deliverPasswordReset(test.ctx, "nobody@example.com")).toBe("no_account");
      expect(sent).toEqual([]);
      expect(await countRows(test.database, "password_resets")).toBe(0);
    });

    it("replaces a pending link: only the newest one works", async () => {
      const first = await issueToken();
      const second = await issueToken();
      expect(await countRows(test.database, "password_resets")).toBe(1);
      expect(await findPasswordResetUser(test.ctx, first)).toBeNull();
      expect((await findPasswordResetUser(test.ctx, second))?.id).toBe(userId);
    });

    it("uses the configured TTL and the app's route override", async () => {
      await test.database.close();
      await setUp({ auth: { passwordReset: { send: recordLink, ttlMinutes: 15 }, routes: { resetPassword: "/account/reset" } } });
      await deliverPasswordReset(test.ctx, EMAIL);
      expect(sent[0]?.link).toMatch(/^http:\/\/localhost:3000\/account\/reset\?token=/);
      expect(sent[0]?.details.expiresAt).toEqual(new Date(NOW.getTime() + 15 * MINUTE_MS));
    });

    it("lets a sender error propagate, so the caller logs it", async () => {
      await test.database.close();
      await setUp({ auth: { passwordReset: { send: () => Promise.reject(new Error("smtp down")) } } });
      await expect(deliverPasswordReset(test.ctx, EMAIL)).rejects.toThrow("smtp down");
    });
  });

  describe("findPasswordResetUser", () => {
    it("finds the account of a live token and nothing for a malformed, unknown or expired one", async () => {
      const token = await issueToken();
      expect(await findPasswordResetUser(test.ctx, token)).toEqual({ id: userId, email: EMAIL, createdAt: NOW });
      expect(await findPasswordResetUser(test.ctx, "short")).toBeNull();
      expect(await findPasswordResetUser(test.ctx, "C".repeat(43))).toBeNull();
      test.clock.advance(60 * MINUTE_MS);
      expect(await findPasswordResetUser(test.ctx, token)).toBeNull();
    });
  });

  describe("resetPassword", () => {
    it("sets the new password, ends every session and consumes the link", async () => {
      const session = await createSession(test.ctx, userId);
      const token = await issueToken();
      test.clock.advance(MINUTE_MS);

      expect(await resetPassword(test.ctx, { token, newPassword: NEW_PASSWORD, clientKey: CLIENT })).toEqual({ ok: true, value: undefined });
      expect(await findSessionUser(test.ctx, session.token)).toBeNull();
      expect(await countRows(test.database, "sessions")).toBe(0);
      expect(await countRows(test.database, "password_resets")).toBe(0);
      expect(await loginUser(test.ctx, { email: EMAIL, password: PASSWORD, clientKey: CLIENT })).toMatchObject({ error: "auth.invalid_credentials" });
      expect((await loginUser(test.ctx, { email: EMAIL, password: NEW_PASSWORD, clientKey: CLIENT })).ok).toBe(true);
      const changed = await test.database.client.query<{ password_changed_at: Date }>("SELECT password_changed_at FROM auth.users");
      expect(changed.rows[0]?.password_changed_at).toEqual(new Date(NOW.getTime() + MINUTE_MS));
    });

    it("works once", async () => {
      const token = await issueToken();
      expect((await resetPassword(test.ctx, { token, newPassword: NEW_PASSWORD, clientKey: CLIENT })).ok).toBe(true);
      expect(await resetPassword(test.ctx, { token, newPassword: "yet another passphrase", clientKey: CLIENT })).toEqual({
        ok: false,
        error: "auth.reset_token_invalid",
      });
    });

    it("lets only one of two parallel submissions win", async () => {
      const token = await issueToken();
      const results = await Promise.all([
        resetPassword(test.ctx, { token, newPassword: NEW_PASSWORD, clientKey: CLIENT }),
        resetPassword(test.ctx, { token, newPassword: "yet another passphrase", clientKey: CLIENT }),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, error: "auth.reset_token_invalid" }]);
    });

    it("refuses an expired link and keeps the password", async () => {
      const token = await issueToken();
      test.clock.advance(60 * MINUTE_MS);
      expect(await resetPassword(test.ctx, { token, newPassword: NEW_PASSWORD, clientKey: CLIENT })).toEqual({
        ok: false,
        error: "auth.reset_token_invalid",
      });
      expect((await loginUser(test.ctx, { email: EMAIL, password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
    });

    it.each([
      ["a malformed token", "not a token"],
      ["an unknown token", "C".repeat(43)],
    ])("refuses %s", async (_case, token) => {
      expect(await resetPassword(test.ctx, { token, newPassword: NEW_PASSWORD, clientKey: CLIENT })).toEqual({
        ok: false,
        error: "auth.reset_token_invalid",
      });
    });

    it.each([
      ["too short", "short", "auth.password_too_short"],
      ["too long", "x".repeat(1025), "auth.password_too_long"],
    ])("refuses a new password that is %s and keeps the link", async (_case, newPassword, error) => {
      const token = await issueToken();
      expect(await resetPassword(test.ctx, { token, newPassword, clientKey: CLIENT })).toEqual({ ok: false, error });
      expect((await findPasswordResetUser(test.ctx, token))?.id).toBe(userId);
    });

    it("counts password-reset-confirm per client and refuses once it is spent", async () => {
      await test.database.close();
      await setUp({ buckets: { "password-reset-confirm": { limit: 1, windowMinutes: 15 } } });
      const token = await issueToken();
      expect(await resetPassword(test.ctx, { token: "C".repeat(43), newPassword: NEW_PASSWORD, clientKey: CLIENT })).toMatchObject({
        error: "auth.reset_token_invalid",
      });
      expect(await resetPassword(test.ctx, { token, newPassword: NEW_PASSWORD, clientKey: CLIENT })).toMatchObject({
        ok: false,
        error: "security.rate_limited",
      });
    });
  });

  it("a password change cancels a pending link", async () => {
    const session = await createSession(test.ctx, userId);
    const token = await issueToken();
    expect((await changePassword(test.ctx, { sessionToken: session.token, currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).ok).toBe(true);
    expect(await findPasswordResetUser(test.ctx, token)).toBeNull();
  });

  it("prunes expired links only", async () => {
    await issueToken();
    expect(await prunePasswordResets(test.ctx)).toBe(0);
    test.clock.advance(60 * MINUTE_MS);
    expect(await prunePasswordResets(test.ctx)).toBe(1);
    expect(await countRows(test.database, "password_resets")).toBe(0);
  });

  it("builds the link on appOrigin, not on a request host", () => {
    expect(getPasswordResetLink(test.config, "T".repeat(43))).toBe(`http://localhost:3000/reset-password?token=${"T".repeat(43)}`);
  });
});

describe("password reset without a sender", () => {
  let test: TestAuth;

  beforeEach(async () => {
    test = await createTestAuth();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("is off: requests and resets are refused before anything is counted", async () => {
    expect(isPasswordResetEnabled(test.config)).toBe(false);
    expect(await requestPasswordReset(test.ctx, { email: EMAIL, clientKey: CLIENT })).toEqual({ ok: false, error: "auth.password_reset_unavailable" });
    expect(await resetPassword(test.ctx, { token: "C".repeat(43), newPassword: NEW_PASSWORD, clientKey: CLIENT })).toEqual({
      ok: false,
      error: "auth.password_reset_unavailable",
    });
    expect(await listAttempts(test.database)).toEqual([]);
    await expect(deliverPasswordReset(test.ctx, EMAIL)).rejects.toThrow("auth({ passwordReset: { send } })");
  });
});

describe("consolePasswordResetSender", () => {
  const user: AuthUser = { id: "00000000-0000-4000-8000-000000000000", email: EMAIL, createdAt: NOW };
  const details: PasswordResetDetails = { expiresAt: new Date(NOW.getTime() + 60 * MINUTE_MS), locale: "en" };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prints the link in development", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await consolePasswordResetSender("http://localhost:3000/reset-password?token=x", user, details);
    expect(info).toHaveBeenCalledWith(
      "@softure-ai/auth: password reset link for ada@example.com, valid until 2026-09-15T13:00:00.000Z: http://localhost:3000/reset-password?token=x",
    );
  });

  it("refuses in production, where the link would land in the logs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await expect(consolePasswordResetSender("http://localhost:3000/reset-password?token=x", user, details)).rejects.toThrow(/development only/);
    expect(info).not.toHaveBeenCalled();
  });
});
