import { REGISTRATION_CLOSED_ENV, REGISTRATION_CLOSED_SWITCH, users } from "@softure-ai/auth";
import { defineModule, type SwitchReader, type SwitchReading } from "@softure-ai/core";
import { findSessionUser, isRegistrationClosed, registerUser, verifyPassword, type RegisterInput } from "@softure-ai/auth/server";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, countRows, createTestAuth, DAY_MS, listAttempts, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

/** A switch provider that knows only the switches in `values`, as feature-switches does for the app's definitions. */
function switchProvider(values: Readonly<Record<string, boolean>>, calls: string[] = []) {
  const switchReader: SwitchReader = (_context, name) => {
    calls.push(name);
    const isEnabled = values[name];
    return Promise.resolve<SwitchReading>(isEnabled === undefined ? { kind: "undeclared" } : { kind: "value", isEnabled });
  };
  const manifest = {
    id: "switch-provider",
    version: "0.0.0",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  };
  return defineModule({ manifest, messages: { en: {}, pl: {} }, switchReader })();
}

const INPUT: RegisterInput = { email: "  Ada@Example.com ", password: PASSWORD, hasConsented: true, clientKey: CLIENT };

describe("registerUser", () => {
  let test: TestAuth;

  async function setUp(options: ConfigOptions = {}): Promise<TestAuth> {
    test = await createTestAuth(options);
    return test;
  }

  afterEach(async () => {
    vi.unstubAllEnvs();
    await test.database.close();
  });

  it("creates the account with a normalized email and signs it in", async () => {
    const { ctx, database } = await setUp();
    const result = await registerUser(ctx, INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user).toEqual({ id: expect.any(String) as string, email: "ada@example.com", createdAt: NOW });
    expect(result.value.session.expiresAt).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
    expect(await findSessionUser(ctx, result.value.session.token)).toEqual(result.value.user);

    const [row] = await database.db.select().from(users);
    expect(row?.passwordChangedAt).toEqual(NOW);
    expect(await verifyPassword(PASSWORD, row?.passwordHash ?? "")).toBe(true);
  });

  it("stores only the sha256 of the session token", async () => {
    const { ctx, database } = await setUp();
    const result = await registerUser(ctx, INPUT);
    if (!result.ok) throw new Error("registration failed");
    const token = result.value.session.token;
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    const rows = await database.client.query<{ token_hash: string }>("SELECT token_hash FROM auth.sessions");
    expect(rows.rows).toEqual([{ token_hash: createHash("sha256").update(token).digest("hex") }]);
  });

  it("refuses a taken email in another spelling and keeps one account", async () => {
    const { ctx, database } = await setUp();
    await registerUser(ctx, INPUT);
    expect(await registerUser(ctx, { ...INPUT, email: "ADA@example.com" })).toEqual({ ok: false, error: "auth.email_taken" });
    expect(await countRows(database, "users")).toBe(1);
    expect(await countRows(database, "sessions")).toBe(1);
  });

  it.each([
    ["an invalid email", { email: "ada@" }, "auth.email_invalid"],
    ["an email over 254 characters", { email: `${"a".repeat(250)}@x.io` }, "auth.email_invalid"],
    ["a password under the minimum", { password: "123456789" }, "auth.password_too_short"],
    ["a password over 1024 characters", { password: "x".repeat(1025) }, "auth.password_too_long"],
    ["a missing consent", { hasConsented: false }, "auth.consent_required"],
  ] as const)("refuses %s without counting an attempt", async (_case, change, error) => {
    const { ctx, database } = await setUp();
    expect(await registerUser(ctx, { ...INPUT, ...change })).toEqual({ ok: false, error });
    expect(await countRows(database, "users")).toBe(0);
    expect(await listAttempts(database)).toEqual([]);
  });

  it("accepts a password of exactly the minimum length, counted in characters", async () => {
    const { ctx } = await setUp({ auth: { password: { minLength: 10 } } });
    expect((await registerUser(ctx, { ...INPUT, password: "\u{1F511}".repeat(10) })).ok).toBe(true);
  });

  it("registers without consent when the app turned it off, and tells the hook there was none", async () => {
    const onRegistered = vi.fn(() => Promise.resolve());
    const { ctx } = await setUp({ auth: { requireConsent: false, onRegistered } });
    expect((await registerUser(ctx, { ...INPUT, hasConsented: false })).ok).toBe(true);
    expect(onRegistered).toHaveBeenCalledWith(
      { user: expect.objectContaining({ email: "ada@example.com" }) as unknown, consent: null, fields: {} },
      expect.anything(),
    );
  });

  it("hands the declared registration fields to onRegistered, trimmed to 512 characters, and drops the rest", async () => {
    const onRegistered = vi.fn(() => Promise.resolve());
    const { ctx } = await setUp({ auth: { registrationFields: ["channel", "referrer", "plan"], onRegistered } });
    const fields = { channel: "newsletter", referrer: "x".repeat(600), plan: "", admin: "true" };
    expect((await registerUser(ctx, { ...INPUT, fields })).ok).toBe(true);
    expect(onRegistered).toHaveBeenCalledWith(expect.objectContaining({ fields: { channel: "newsletter", referrer: "x".repeat(512) } }), expect.anything());
  });

  it("calls onRegistered with the user and the consent time inside the transaction", async () => {
    let seenInTransaction = 0;
    const { ctx } = await setUp({
      auth: {
        onRegistered: async (event, hookCtx) => {
          expect(event.consent).toEqual({ acceptedAt: NOW });
          const rows = await hookCtx.db.select().from(users);
          seenInTransaction = rows.length;
        },
      },
    });
    expect((await registerUser(ctx, INPUT)).ok).toBe(true);
    expect(seenInTransaction).toBe(1);
  });

  it("rolls the account back when onRegistered throws", async () => {
    const { ctx, database } = await setUp({ auth: { onRegistered: () => Promise.reject(new Error("consent store is down")) } });
    await expect(registerUser(ctx, INPUT)).rejects.toThrow("consent store is down");
    expect(await countRows(database, "users")).toBe(0);
    expect(await countRows(database, "sessions")).toBe(0);
  });

  it("counts the register bucket per client and refuses once it is spent", async () => {
    const { ctx, database } = await setUp({ buckets: { register: { limit: 2, windowMinutes: 15 }, login: { limit: 9, windowMinutes: 15 } } });
    expect((await registerUser(ctx, { ...INPUT, email: "a@example.com" })).ok).toBe(true);
    expect((await registerUser(ctx, { ...INPUT, email: "b@example.com" })).ok).toBe(true);
    expect(await registerUser(ctx, { ...INPUT, email: "c@example.com" })).toMatchObject({ ok: false, error: "security.rate_limited", retryAfterSeconds: 900 });
    expect(await countRows(database, "users")).toBe(2);
    expect(await listAttempts(database)).toEqual(["register ip:192.0.2.10 3"]);
  });

  describe("the auth.registration_closed switch", () => {
    it("refuses when the declared default closes registration", async () => {
      const { ctx, database } = await setUp({ auth: { registrationClosed: true } });
      expect(await registerUser(ctx, INPUT)).toEqual({ ok: false, error: "auth.registration_closed" });
      expect(await listAttempts(database)).toEqual([]);
    });

    it.each(["true", "1", " TRUE "])("closes registration when the env override is %j", async (value) => {
      vi.stubEnv(REGISTRATION_CLOSED_ENV, value);
      const { ctx } = await setUp();
      expect(await registerUser(ctx, INPUT)).toEqual({ ok: false, error: "auth.registration_closed" });
    });

    it.each(["false", "0"])("opens a closed default when the env override is %j", async (value) => {
      vi.stubEnv(REGISTRATION_CLOSED_ENV, value);
      const { ctx } = await setUp({ auth: { registrationClosed: true } });
      expect((await registerUser(ctx, INPUT)).ok).toBe(true);
    });

    it("follows the app's switch provider over the declared default and the env override", async () => {
      vi.stubEnv(REGISTRATION_CLOSED_ENV, "true");
      const calls: string[] = [];
      const { ctx, database } = await setUp({ auth: { registrationClosed: true }, modules: [switchProvider({ [REGISTRATION_CLOSED_SWITCH]: false }, calls)] });
      expect(await isRegistrationClosed(ctx)).toBe(false);
      expect((await registerUser(ctx, INPUT)).ok).toBe(true);
      expect(await countRows(database, "users")).toBe(1);
      expect(calls).toEqual([REGISTRATION_CLOSED_SWITCH, REGISTRATION_CLOSED_SWITCH]);
    });

    it("refuses when the app's switch provider has it on", async () => {
      const { ctx, database } = await setUp({ modules: [switchProvider({ [REGISTRATION_CLOSED_SWITCH]: true })] });
      expect(await registerUser(ctx, INPUT)).toEqual({ ok: false, error: "auth.registration_closed" });
      expect(await listAttempts(database)).toEqual([]);
    });

    it("falls back to the declared default when the provider does not define the switch", async () => {
      const { ctx } = await setUp({ auth: { registrationClosed: true }, modules: [switchProvider({})] });
      expect(await isRegistrationClosed(ctx)).toBe(true);
    });

    it("fails closed on an env value it cannot read and logs the variable name only, once", async () => {
      vi.stubEnv(REGISTRATION_CLOSED_ENV, "maybe");
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { ctx } = await setUp();
      expect(await registerUser(ctx, INPUT)).toEqual({ ok: false, error: "auth.registration_closed" });
      // Once per process, not on every request (another test may have reported it already).
      expect(log.mock.calls.length).toBeLessThanOrEqual(1);
      await registerUser(ctx, INPUT);
      expect(log.mock.calls.length).toBeLessThanOrEqual(1);
      for (const call of log.mock.calls) {
        expect(call).toEqual([`@softure-ai/auth: ${REGISTRATION_CLOSED_ENV} must be true, false, 1 or 0; registration stays closed`]);
      }
      log.mockRestore();
    });
  });
});
