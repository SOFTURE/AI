import { createTestClock } from "@softure-ai/core";
import { registerUser } from "@softure-ai/auth/server";
import { createGrantRoleScript, createRevokeRoleScript } from "@softure-ai/auth/scripts";
import { executeOpsScript, runOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestAuth, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

describe("the role scripts", () => {
  let test: TestAuth;
  let adaId: string;

  async function setUp(options: ConfigOptions = {}): Promise<void> {
    test = await createTestAuth(options);
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    adaId = registered.value.user.id;
  }

  async function listRoleRows(): Promise<string[]> {
    const result = await test.database.client.query<{ role: string }>("SELECT role FROM auth.user_roles ORDER BY role");
    return result.rows.map((row) => row.role);
  }

  function grant() {
    return createGrantRoleScript(test.config, { clock: createTestClock(NOW) });
  }

  function revoke() {
    return createRevokeRoleScript(test.config);
  }

  afterEach(async () => {
    await test.database.close();
  });

  describe("grant-role", () => {
    beforeEach(async () => {
      await setUp({ auth: { roles: ["editor"] } });
    });

    it("writes nothing on a dry run and reports the change it would make, by user id", async () => {
      const outcome = await executeOpsScript(test.database.db, grant(), { email: "ada@example.com", role: "admin" }, { commit: false });
      expect(outcome).toEqual({
        ok: true,
        value: { committed: false, report: { before: { userId: adaId, roles: [] }, after: { userId: adaId, roles: ["admin"] } } },
      });
      expect(await listRoleRows()).toEqual([]);
    });

    it("stores the role with --commit, finding the account whatever the email's case", async () => {
      const outcome = await executeOpsScript(test.database.db, grant(), { email: " ADA@example.com", role: "editor" }, { commit: true });
      expect(outcome).toMatchObject({ ok: true, value: { committed: true } });
      expect(await listRoleRows()).toEqual(["editor"]);
    });

    it.each([
      ["an unknown email", { email: "nobody@example.com", role: "admin" }, "no account has this email"],
      ["an undeclared role", { email: "ada@example.com", role: "owner" }, 'role "owner" is not declared (declared: admin, editor)'],
    ])("refuses %s and writes nothing", async (_case, args, reason) => {
      const outcome = await executeOpsScript(test.database.db, grant(), args, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason });
      expect(await listRoleRows()).toEqual([]);
    });

    it("refuses a role the account already has", async () => {
      await executeOpsScript(test.database.db, grant(), { email: "ada@example.com", role: "admin" }, { commit: true });
      const outcome = await executeOpsScript(test.database.db, grant(), { email: "ada@example.com", role: "admin" }, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason: 'the account already has role "admin"' });
    });

    it("runs as a command and never prints the email", async () => {
      const lines: string[] = [];
      const output = { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) };
      const code = await runOpsScript({
        script: grant(),
        argv: ["--email=ada@example.com", "--role=admin", "--commit"],
        config: test.config,
        database: test.database.db,
        output,
      });
      expect(code).toBe(0);
      expect(lines.at(-1)).toBe("COMMITTED");
      expect(lines.join("\n")).not.toContain("ada@example.com");
      expect(await listRoleRows()).toEqual(["admin"]);
    });
  });

  describe("revoke-role", () => {
    it("deletes a stored role with --commit", async () => {
      await setUp();
      await executeOpsScript(test.database.db, grant(), { email: "ada@example.com", role: "admin" }, { commit: true });
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", role: "admin" }, { commit: true });
      expect(outcome).toEqual({
        ok: true,
        value: { committed: true, report: { before: { userId: adaId, roles: ["admin"] }, after: { userId: adaId, roles: [] } } },
      });
      expect(await listRoleRows()).toEqual([]);
    });

    it("refuses a role the account does not have stored", async () => {
      await setUp();
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", role: "admin" }, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason: 'the account has no stored role "admin"' });
    });

    it("points at adminEmails when admin comes from the configuration", async () => {
      await setUp({ auth: { adminEmails: ["ada@example.com"] } });
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", role: "admin" }, { commit: true });
      expect(outcome).toEqual({
        ok: false,
        error: "ops.script_refused",
        reason: "admin comes from auth({ adminEmails }) in softure.config.ts; remove the email there",
      });
    });
  });
});
