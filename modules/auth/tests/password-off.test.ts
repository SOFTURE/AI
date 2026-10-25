// `password: { enabled: false }`: OpenID Connect is the only way in, and every password path refuses.
import { createTestAccount, createFakeOidcProvider } from "@softure-ai/auth/testing";
import { changePassword, createSession, isPasswordResetEnabled, isRegistrationClosed, loginUser, registerUser, requestPasswordReset } from "@softure-ai/auth/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestAuth, PASSWORD, type TestAuth } from "./support.js";

describe("passwords switched off", () => {
  let test: TestAuth;

  beforeEach(async () => {
    const fake = createFakeOidcProvider();
    test = await createTestAuth({
      auth: { password: { enabled: false }, passwordReset: { send: () => Promise.resolve() }, oidc: { providers: [fake.definition], fetch: fake.fetch } },
    });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("opens no session with a correct password", async () => {
    await createTestAccount(test.ctx, { email: "ada@example.com", password: PASSWORD });
    expect(await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT })).toEqual({ ok: false, error: "auth.invalid_credentials" });
  });

  it("keeps registration closed and creates no account", async () => {
    expect(await isRegistrationClosed(test.ctx, {})).toBe(true);
    expect(await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT })).toEqual({
      ok: false,
      error: "auth.registration_closed",
    });
  });

  it("offers no password reset and no password change", async () => {
    expect(isPasswordResetEnabled(test.config)).toBe(false);
    expect(await requestPasswordReset(test.ctx, { email: "ada@example.com", clientKey: CLIENT })).toEqual({ ok: false, error: "auth.password_reset_unavailable" });
    const user = await createTestAccount(test.ctx, { email: "ada@example.com", password: PASSWORD });
    const session = await createSession(test.ctx, user.id);
    expect(await changePassword(test.ctx, { sessionToken: session.token, currentPassword: PASSWORD, newPassword: `${PASSWORD}!` })).toEqual({
      ok: false,
      error: "auth.forbidden",
    });
  });
});
