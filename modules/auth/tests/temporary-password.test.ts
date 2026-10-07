import { createTestClock } from "@softure-ai/core";
import { createSession, findSessionUser, issuePasswordReset, loginUser, registerUser } from "@softure-ai/auth/server";
import { createSetTemporaryPasswordScript } from "@softure-ai/auth/scripts";
import { executeOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, countRows, createTestAuth, NOW, PASSWORD, type TestAuth } from "./support.js";

const LATER = new Date(NOW.getTime() + 60_000);

describe("set-temporary-password", () => {
  let test: TestAuth;
  let adaId: string;
  let token: string;

  beforeEach(async () => {
    test = await createTestAuth({ auth: { passwordReset: { send: () => Promise.resolve() } } });
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    adaId = registered.value.user.id;
    token = registered.value.session.token;
    await createSession(test.ctx, adaId);
    await issuePasswordReset(test.ctx, adaId);
    expect(await countRows(test.database, "password_resets")).toBe(1);
  });
  afterEach(async () => {
    await test.database.close();
  });

  function script() {
    return createSetTemporaryPasswordScript(test.config, { clock: createTestClock(LATER) });
  }

  it("writes nothing on a dry run and reports what it would end, by user id", async () => {
    const outcome = await executeOpsScript(test.database.db, script(), { email: "ada@example.com" }, { commit: false });
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.value.report.before).toEqual({ userId: adaId, sessions: 2 });
    expect(outcome.value.report.after).toEqual({ userId: adaId, sessions: 0, temporaryPassword: expect.stringMatching(/^[A-Za-z0-9_-]{20}$/) as string });
    expect((await findSessionUser(test.ctx, token))?.id).toBe(adaId);
    expect((await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
  });

  it("with --commit sets a password the login accepts, ends every session and the pending reset link", async () => {
    const outcome = await executeOpsScript(test.database.db, script(), { email: " ADA@example.com" }, { commit: true });
    if (!outcome.ok) throw new Error(outcome.reason);
    const { temporaryPassword } = outcome.value.report.after as { temporaryPassword: string };
    expect(await findSessionUser(test.ctx, token)).toBeNull();
    expect(await countRows(test.database, "password_resets")).toBe(0);
    expect(await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT })).toMatchObject({ error: "auth.invalid_credentials" });
    expect((await loginUser(test.ctx, { email: "ada@example.com", password: temporaryPassword, clientKey: CLIENT })).ok).toBe(true);
    const changed = await test.database.client.query<{ password_changed_at: Date }>("SELECT password_changed_at FROM auth.users");
    expect(changed.rows[0]?.password_changed_at).toEqual(LATER);
  });

  it("makes the password at least as long as the app's minimum", async () => {
    await test.database.close();
    test = await createTestAuth({ auth: { password: { minLength: 32 } } });
    expect((await registerUser(test.ctx, { email: "bo@example.com", password: "p".repeat(32), hasConsented: true, clientKey: CLIENT })).ok).toBe(true);
    const outcome = await executeOpsScript(test.database.db, script(), { email: "bo@example.com" }, { commit: false });
    if (!outcome.ok) throw new Error(outcome.reason);
    expect((outcome.value.report.after as { temporaryPassword: string }).temporaryPassword).toHaveLength(32);
  });

  it("refuses an unknown email and writes nothing", async () => {
    const outcome = await executeOpsScript(test.database.db, script(), { email: "nobody@example.com" }, { commit: true });
    expect(outcome).toMatchObject({ ok: false, reason: "no account has this email" });
    expect(await countRows(test.database, "sessions")).toBe(2);
  });
});
