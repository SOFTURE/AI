import { createTestClock } from "@softure-ai/core";
import {
  createSession,
  createTemporaryPassword,
  findSessionUser,
  hashPassword,
  issuePasswordReset,
  loginUser,
  READABLE_PASSWORD_ALPHABET,
  registerUser,
} from "@softure-ai/auth/server";
import { createSetTemporaryPasswordScript } from "@softure-ai/auth/scripts";
import { executeOpsScript, runOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, countRows, createTestAuth, FAST_SCRYPT, NOW, PASSWORD, type TestAuth } from "./support.js";

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

  it("with an alphabet option draws the password from that alphabet only", async () => {
    const readable = createSetTemporaryPasswordScript(test.config, { clock: createTestClock(LATER), alphabet: READABLE_PASSWORD_ALPHABET });
    const outcome = await executeOpsScript(test.database.db, readable, { email: "ada@example.com" }, { commit: true });
    if (!outcome.ok) throw new Error(outcome.reason);
    const { temporaryPassword } = outcome.value.report.after as { temporaryPassword: string };
    expect(temporaryPassword).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{20}$/);
    expect((await loginUser(test.ctx, { email: "ada@example.com", password: temporaryPassword, clientKey: CLIENT })).ok).toBe(true);
  });

  describe("with a precomputed --password-hash", () => {
    const localPassword = "Kq7mWx2pRt9vNb4hZc6d";

    it("stores the given hash, so the locally computed password logs in, and reports no password", async () => {
      const passwordHash = await hashPassword(localPassword, FAST_SCRYPT);
      const outcome = await executeOpsScript(test.database.db, script(), { email: "ada@example.com", "password-hash": passwordHash }, { commit: true });
      if (!outcome.ok) throw new Error(outcome.reason);
      expect(outcome.value.report).toEqual({ before: { userId: adaId, sessions: 2 }, after: { userId: adaId, sessions: 0, passwordFrom: "hash" } });
      expect(await findSessionUser(test.ctx, token)).toBeNull();
      expect(await countRows(test.database, "password_resets")).toBe(0);
      expect((await loginUser(test.ctx, { email: "ada@example.com", password: localPassword, clientKey: CLIENT })).ok).toBe(true);
      const stored = await test.database.client.query<{ password_hash: string }>("SELECT password_hash FROM auth.users");
      expect(stored.rows[0]?.password_hash).toBe(passwordHash);
    });

    it("writes nothing on a dry run", async () => {
      const passwordHash = await hashPassword(localPassword, FAST_SCRYPT);
      const outcome = await executeOpsScript(test.database.db, script(), { email: "ada@example.com", "password-hash": passwordHash }, { commit: false });
      if (!outcome.ok) throw new Error(outcome.reason);
      expect(outcome.value.committed).toBe(false);
      expect((await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
    });

    it("reads the hash from stdin with --password-hash-file=- and never prints it", async () => {
      const passwordHash = await hashPassword(localPassword, FAST_SCRYPT);
      const lines: string[] = [];
      const code = await runOpsScript({
        script: script(),
        argv: ["--email=ada@example.com", "--password-hash-file=-", "--commit"],
        config: test.config,
        database: test.database.db,
        output: { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) },
        readInput: { readFile: () => Promise.reject(new Error("no files")), readStdin: () => Promise.resolve(`${passwordHash}\n`) },
      });
      expect(code).toBe(0);
      expect(lines.at(-1)).toBe("COMMITTED");
      expect(lines.join("\n")).not.toContain(passwordHash);
      expect((await loginUser(test.ctx, { email: "ada@example.com", password: localPassword, clientKey: CLIENT })).ok).toBe(true);
    });

    it("refuses a value that is not a scrypt hash as a usage error without echoing it", async () => {
      const lines: string[] = [];
      const code = await runOpsScript({
        script: script(),
        argv: ["--email=ada@example.com", "--password-hash=plain-secret-by-mistake", "--commit"],
        config: test.config,
        database: test.database.db,
        output: { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) },
      });
      expect(code).toBe(2);
      expect(lines[0]).toBe("set-temporary-password: --password-hash: is not a scrypt hash written by @softure-ai/auth");
      expect(lines.join("\n")).not.toContain("plain-secret-by-mistake");
      expect((await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
    });
    it("refuses a hash cut by one character, so the account is not locked", async () => {
      const passwordHash = await hashPassword(localPassword, FAST_SCRYPT);
      const lines: string[] = [];
      const code = await runOpsScript({
        script: script(),
        argv: ["--email=ada@example.com", "--password-hash-file=-", "--commit"],
        config: test.config,
        database: test.database.db,
        output: { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) },
        readInput: { readFile: () => Promise.reject(new Error("no files")), readStdin: () => Promise.resolve(`${passwordHash.slice(0, -1)}\n`) },
      });
      expect(code).toBe(2);
      expect(lines[0]).toBe("set-temporary-password: --password-hash: is not a scrypt hash written by @softure-ai/auth");
      expect(lines.join("\n")).not.toContain(passwordHash.slice(0, -1));
      expect((await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
    });
  });

  it("refuses an unknown email and writes nothing", async () => {
    const outcome = await executeOpsScript(test.database.db, script(), { email: "nobody@example.com" }, { commit: true });
    expect(outcome).toMatchObject({ ok: false, reason: "no account has this email" });
    expect(await countRows(test.database, "sessions")).toBe(2);
  });
});

describe("createTemporaryPassword", () => {
  it("defaults to 20 base64url characters", () => {
    expect(createTemporaryPassword()).toMatch(/^[A-Za-z0-9_-]{20}$/);
  });

  it("draws only from the given alphabet, at the given length", () => {
    expect(createTemporaryPassword({ alphabet: "ab", length: 64 })).toMatch(/^[ab]{64}$/);
    expect(createTemporaryPassword({ alphabet: READABLE_PASSWORD_ALPHABET, length: 200 })).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{200}$/);
  });

  it("gives a readable alphabet of 57 characters with none that read alike or break a dictated password", () => {
    expect(READABLE_PASSWORD_ALPHABET).toHaveLength(57);
    expect(new Set(READABLE_PASSWORD_ALPHABET).size).toBe(57);
    for (const confusable of ["0", "O", "1", "l", "I", "-", "_"]) expect(READABLE_PASSWORD_ALPHABET).not.toContain(confusable);
  });

  it("uses every character of the alphabet", () => {
    const drawn = new Set(createTemporaryPassword({ alphabet: READABLE_PASSWORD_ALPHABET, length: 4000 }));
    expect(drawn.size).toBe(57);
  });

  it("throws on a length below 1, an alphabet under 2 characters and a repeated character", () => {
    expect(() => createTemporaryPassword({ length: 0 })).toThrow("@softure-ai/auth: createTemporaryPassword needs a whole length of at least 1");
    expect(() => createTemporaryPassword({ length: 2.5 })).toThrow("@softure-ai/auth: createTemporaryPassword needs a whole length of at least 1");
    expect(() => createTemporaryPassword({ alphabet: "a" })).toThrow("@softure-ai/auth: createTemporaryPassword needs an alphabet of at least 2 distinct characters");
    expect(() => createTemporaryPassword({ alphabet: "abca" })).toThrow("@softure-ai/auth: createTemporaryPassword needs an alphabet of at least 2 distinct characters");
  });
});
