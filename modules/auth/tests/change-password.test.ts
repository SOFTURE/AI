import { changePassword, createSession, findSessionUser, loginUser, registerUser, type ChangePasswordInput } from "@softure-ai/auth/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestAuth, listAttempts, NOW, PASSWORD, type TestAuth } from "./support.js";

const NEW_PASSWORD = "a brand new passphrase";

describe("changePassword", () => {
  let test: TestAuth;
  let userId: string;
  let input: ChangePasswordInput;

  beforeEach(async () => {
    test = await createTestAuth();
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    userId = registered.value.user.id;
    input = { sessionToken: registered.value.session.token, currentPassword: PASSWORD, newPassword: NEW_PASSWORD };
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("changes the password, keeps the current session and ends every other one", async () => {
    const other = await createSession(test.ctx, userId);
    test.clock.advance(60_000);
    expect(await changePassword(test.ctx, input)).toEqual({ ok: true, value: undefined });
    expect((await findSessionUser(test.ctx, input.sessionToken))?.id).toBe(userId);
    expect(await findSessionUser(test.ctx, other.token)).toBeNull();

    expect(await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT })).toMatchObject({ error: "auth.invalid_credentials" });
    expect((await loginUser(test.ctx, { email: "ada@example.com", password: NEW_PASSWORD, clientKey: CLIENT })).ok).toBe(true);
    const changed = await test.database.client.query<{ password_changed_at: Date }>("SELECT password_changed_at FROM auth.users");
    expect(changed.rows[0]?.password_changed_at).toEqual(new Date(NOW.getTime() + 60_000));
  });

  it("refuses a wrong current password and changes nothing", async () => {
    const other = await createSession(test.ctx, userId);
    expect(await changePassword(test.ctx, { ...input, currentPassword: "wrong horse battery" })).toEqual({
      ok: false,
      error: "auth.current_password_invalid",
    });
    expect(await findSessionUser(test.ctx, other.token)).not.toBeNull();
  });

  it.each([
    ["too short", "short", "auth.password_too_short"],
    ["too long", "x".repeat(1025), "auth.password_too_long"],
  ])("refuses a new password that is %s", async (_case, newPassword, error) => {
    expect(await changePassword(test.ctx, { ...input, newPassword })).toEqual({ ok: false, error });
  });

  it.each([
    ["the same string", PASSWORD],
    ["the same password in another Unicode form", PASSWORD.normalize("NFD")],
  ])("refuses a new password that is the current one: %s", async (_case, newPassword) => {
    const other = await createSession(test.ctx, userId);
    expect(await changePassword(test.ctx, { ...input, newPassword })).toEqual({ ok: false, error: "auth.password_unchanged" });
    expect(await findSessionUser(test.ctx, other.token)).not.toBeNull();
    const changed = await test.database.client.query<{ password_changed_at: Date }>("SELECT password_changed_at FROM auth.users");
    expect(changed.rows[0]?.password_changed_at).toEqual(NOW);
  });

  it("checks the current password before saying the new one is unchanged", async () => {
    expect(await changePassword(test.ctx, { ...input, currentPassword: "wrong horse battery", newPassword: "wrong horse battery" })).toEqual({
      ok: false,
      error: "auth.current_password_invalid",
    });
  });

  it("refuses without a live session", async () => {
    expect(await changePassword(test.ctx, { ...input, sessionToken: "C".repeat(43) })).toEqual({ ok: false, error: "auth.unauthenticated" });
  });

  it("counts the change-password bucket per user and refuses once it is spent", async () => {
    const test2 = await createTestAuth({
      buckets: { register: { limit: 5, windowMinutes: 15 }, "change-password": { limit: 1, windowMinutes: 15 } },
    });
    try {
      const registered = await registerUser(test2.ctx, { email: "bo@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
      if (!registered.ok) throw new Error("setup failed");
      const own = { ...input, sessionToken: registered.value.session.token };
      expect(await changePassword(test2.ctx, { ...own, currentPassword: "wrong horse battery" })).toMatchObject({ error: "auth.current_password_invalid" });
      expect(await changePassword(test2.ctx, own)).toMatchObject({ ok: false, error: "security.rate_limited" });
      expect(await listAttempts(test2.database)).toEqual([
        expect.stringMatching(/^change-password subject:[0-9a-f]{32} 2$/) as string,
        "register ip:192.0.2.10 1",
      ]);
    } finally {
      await test2.database.close();
    }
  });
});
