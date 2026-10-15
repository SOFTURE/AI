import { createTestClock } from "@softure-ai/core";
import { hashPassword, loginUser, READABLE_PASSWORD_ALPHABET, registerUser } from "@softure-ai/auth/server";
import { createCreateAccountScript } from "@softure-ai/auth/scripts";
import { executeOpsScript, runOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, countRows, createTestAuth, FAST_SCRYPT, NOW, PASSWORD, type TestAuth } from "./support.js";

const LATER = new Date(NOW.getTime() + 60_000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("create-account", () => {
  let test: TestAuth;

  beforeEach(async () => {
    test = await createTestAuth({ auth: { registrationClosed: true } });
  });
  afterEach(async () => {
    await test.database.close();
  });

  function script(options: { maxAccounts?: number; alphabet?: string } = {}) {
    return createCreateAccountScript(test.config, { clock: createTestClock(LATER), ...options });
  }

  function captureLines() {
    const lines: string[] = [];
    return { lines, output: { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) } };
  }

  it("writes nothing on a dry run and reports the account it would create, by user id", async () => {
    const outcome = await executeOpsScript(test.database.db, script(), { email: "owner@example.com" }, { commit: false });
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.value.committed).toBe(false);
    expect(outcome.value.report).toEqual({
      before: { accounts: 0 },
      after: { userId: expect.stringMatching(UUID) as string, accounts: 1, temporaryPassword: expect.stringMatching(/^[A-Za-z0-9_-]{20}$/) as string },
    });
    expect(await countRows(test.database, "users")).toBe(0);
  });

  it("with --commit creates an account the login accepts while registration is closed", async () => {
    const outcome = await executeOpsScript(test.database.db, script(), { email: " Owner@Example.com " }, { commit: true });
    if (!outcome.ok) throw new Error(outcome.reason);
    const { userId, temporaryPassword } = outcome.value.report.after as { userId: string; temporaryPassword: string };
    const login = await loginUser(test.ctx, { email: "owner@example.com", password: temporaryPassword, clientKey: CLIENT });
    if (!login.ok) throw new Error(login.error);
    expect(login.value.user.id).toBe(userId);
    const stored = await test.database.client.query<{ email: string; created_at: Date; password_changed_at: Date }>(
      "SELECT email, created_at, password_changed_at FROM auth.users",
    );
    expect(stored.rows).toEqual([{ email: "owner@example.com", created_at: LATER, password_changed_at: LATER }]);
  });

  it("makes the password at least as long as the app's minimum and draws from the given alphabet", async () => {
    await test.database.close();
    test = await createTestAuth({ auth: { registrationClosed: true, password: { minLength: 32 } } });
    const outcome = await executeOpsScript(test.database.db, script({ alphabet: READABLE_PASSWORD_ALPHABET }), { email: "owner@example.com" }, { commit: false });
    if (!outcome.ok) throw new Error(outcome.reason);
    expect((outcome.value.report.after as { temporaryPassword: string }).temporaryPassword).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{32}$/);
  });

  it("stores a given --password-hash, so the locally computed password logs in, and reports no password", async () => {
    const localPassword = "Kq7mWx2pRt9vNb4hZc6d";
    const passwordHash = await hashPassword(localPassword, FAST_SCRYPT);
    const outcome = await executeOpsScript(test.database.db, script(), { email: "owner@example.com", "password-hash": passwordHash }, { commit: true });
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.value.report).toEqual({ before: { accounts: 0 }, after: { userId: expect.stringMatching(UUID) as string, accounts: 1, passwordFrom: "hash" } });
    expect((await loginUser(test.ctx, { email: "owner@example.com", password: localPassword, clientKey: CLIENT })).ok).toBe(true);
  });

  it("prints neither the email nor the hash, and refuses a value that is not a hash without echoing it", async () => {
    const passwordHash = await hashPassword("Kq7mWx2pRt9vNb4hZc6d", FAST_SCRYPT);
    const committed = captureLines();
    const code = await runOpsScript({
      script: script(),
      argv: ["--email=owner@example.com", "--password-hash-file=-", "--commit"],
      config: test.config,
      database: test.database.db,
      output: committed.output,
      readInput: { readFile: () => Promise.reject(new Error("no files")), readStdin: () => Promise.resolve(`${passwordHash}\n`) },
    });
    expect(code).toBe(0);
    expect(committed.lines.at(-1)).toBe("COMMITTED");
    expect(committed.lines.join("\n")).not.toContain("owner@example.com");
    expect(committed.lines.join("\n")).not.toContain(passwordHash);

    const refused = captureLines();
    const usage = await runOpsScript({
      script: script(),
      argv: ["--email=second@example.com", "--password-hash=plain-secret-by-mistake", "--commit"],
      config: test.config,
      database: test.database.db,
      output: refused.output,
    });
    expect(usage).toBe(2);
    expect(refused.lines[0]).toBe("create-account: --password-hash: is not a scrypt hash written by @softure-ai/auth");
    expect(refused.lines.join("\n")).not.toContain("plain-secret-by-mistake");
    expect(await countRows(test.database, "users")).toBe(1);
  });

  it("refuses an email that already has an account, in any case, and writes nothing", async () => {
    await executeOpsScript(test.database.db, script(), { email: "owner@example.com" }, { commit: true });
    const outcome = await executeOpsScript(test.database.db, script(), { email: "OWNER@example.com" }, { commit: true });
    expect(outcome).toMatchObject({ ok: false, reason: "an account with this email already exists" });
    expect(await countRows(test.database, "users")).toBe(1);
  });

  it("refuses an invalid email", async () => {
    const outcome = await executeOpsScript(test.database.db, script(), { email: "not-an-email" }, { commit: true });
    expect(outcome).toMatchObject({ ok: false, reason: "the email is not valid" });
    expect(await countRows(test.database, "users")).toBe(0);
  });

  describe("with maxAccounts", () => {
    it("creates the first account up to the limit", async () => {
      const outcome = await executeOpsScript(test.database.db, script({ maxAccounts: 1 }), { email: "owner@example.com" }, { commit: true });
      if (!outcome.ok) throw new Error(outcome.reason);
      expect(outcome.value.report.after).toMatchObject({ accounts: 1 });
    });

    it("refuses when the table already holds that many accounts, whoever created them", async () => {
      await test.database.close();
      test = await createTestAuth();
      expect((await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT })).ok).toBe(true);
      const outcome = await executeOpsScript(test.database.db, script({ maxAccounts: 1 }), { email: "owner@example.com" }, { commit: true });
      expect(outcome).toMatchObject({ ok: false, reason: "the app already holds 1 account(s), its maxAccounts" });
      expect(await countRows(test.database, "users")).toBe(1);
    });

    it("throws at creation for a limit that is not a whole number of at least 1", () => {
      for (const maxAccounts of [0, -1, 1.5]) {
        expect(() => createCreateAccountScript(test.config, { maxAccounts })).toThrow(
          "@softure-ai/auth: createCreateAccountScript needs maxAccounts to be a whole number of at least 1",
        );
      }
    });
  });
});
