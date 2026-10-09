import { ADMIN_ROLE, auth } from "@softure-ai/auth";
import {
  assertDeclaredRole,
  findUserRoles,
  getDeclaredRoles,
  grantRole,
  isDeclaredRole,
  registerUser,
  revokeRole,
} from "@softure-ai/auth/server";
import type { AuthUser } from "@softure-ai/auth";
import { createTestAccount } from "@softure-ai/auth/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestAuth, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

describe("roles", () => {
  let test: TestAuth;
  let ada: AuthUser;

  async function setUp(options: ConfigOptions = {}): Promise<void> {
    test = await createTestAuth(options);
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    ada = registered.value.user;
  }

  async function listRoleRows(): Promise<string[]> {
    const result = await test.database.client.query<{ role: string; granted_at: Date }>("SELECT role, granted_at FROM auth.user_roles ORDER BY role");
    return result.rows.map((row) => `${row.role} ${row.granted_at.toISOString()}`);
  }

  afterEach(async () => {
    await test.database.close();
  });

  it("grants nothing by default: no rows and no admin list means no role", async () => {
    await setUp();
    expect([...(await findUserRoles(test.ctx, ada))]).toEqual([]);
  });

  it("finds a granted role and stores when it was granted", async () => {
    await setUp({ auth: { roles: ["editor"] } });
    expect(await grantRole(test.ctx, { userId: ada.id, role: "editor" })).toEqual({ ok: true, value: undefined });
    expect([...(await findUserRoles(test.ctx, ada))]).toEqual(["editor"]);
    expect(await listRoleRows()).toEqual([`editor ${NOW.toISOString()}`]);
  });

  it("refuses to grant a role twice or a role the app did not declare", async () => {
    await setUp();
    await grantRole(test.ctx, { userId: ada.id, role: ADMIN_ROLE });
    expect(await grantRole(test.ctx, { userId: ada.id, role: ADMIN_ROLE })).toEqual({ ok: false, error: "auth.role_already_granted" });
    expect(await grantRole(test.ctx, { userId: ada.id, role: "editor" })).toEqual({ ok: false, error: "auth.role_undeclared" });
    expect(await listRoleRows()).toEqual([`admin ${NOW.toISOString()}`]);
  });

  it("revokes a stored role and reports a role that was not stored", async () => {
    await setUp();
    await grantRole(test.ctx, { userId: ada.id, role: ADMIN_ROLE });
    expect(await revokeRole(test.ctx, { userId: ada.id, role: ADMIN_ROLE })).toEqual({ ok: true, value: undefined });
    expect([...(await findUserRoles(test.ctx, ada))]).toEqual([]);
    expect(await revokeRole(test.ctx, { userId: ada.id, role: ADMIN_ROLE })).toEqual({ ok: false, error: "auth.role_not_granted" });
  });

  it("makes the account of a listed admin email an admin, and only that account", async () => {
    await setUp({ auth: { adminEmails: ["  ADA@example.com "] } });
    const other = await registerUser(test.ctx, { email: "bob@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!other.ok) throw new Error(`setup: registration failed with ${other.error}`);
    expect([...(await findUserRoles(test.ctx, ada))]).toEqual([ADMIN_ROLE]);
    expect([...(await findUserRoles(test.ctx, other.value.user))]).toEqual([]);
    expect(await listRoleRows()).toEqual([]);
  });

  it("deletes the roles of a deleted account", async () => {
    await setUp();
    await grantRole(test.ctx, { userId: ada.id, role: ADMIN_ROLE });
    await test.database.client.query("DELETE FROM auth.users WHERE id = $1", [ada.id]);
    expect(await listRoleRows()).toEqual([]);
  });

  it("refuses a role name the CHECK constraint does not accept, even past the code", async () => {
    await setUp();
    await expect(
      test.database.client.query("INSERT INTO auth.user_roles (user_id, role, granted_at) VALUES ($1, 'Admin', now())", [ada.id]),
    ).rejects.toThrow(/user_roles_role_check/);
  });

  it("declares admin always and the app's roles besides it", async () => {
    await setUp({ auth: { roles: ["editor", "support"] } });
    expect([...getDeclaredRoles(test.config)]).toEqual([ADMIN_ROLE, "editor", "support"]);
    expect(isDeclaredRole(test.config, "editor")).toBe(true);
    expect(isDeclaredRole(test.config, "amdin")).toBe(false);
  });

  it("throws for a check of an undeclared role, naming the declared ones", async () => {
    await setUp();
    expect(() => assertDeclaredRole(test.config, ADMIN_ROLE)).not.toThrow();
    expect(() => assertDeclaredRole(test.config, "amdin")).toThrow(
      '@softure-ai/auth: role "amdin" is not declared (declared: admin); add it to auth({ roles }) in softure.config.ts',
    );
  });
});

describe("the role options", () => {
  it("refuses role names and admin emails it cannot use, listing every problem", () => {
    expect(() => auth({ roles: ["Editor", "x".repeat(33)], adminEmails: ["not an email"] })).toThrow(
      [
        'Invalid SOFTURE configuration in module "auth":',
        "- options.roles.0: must be a role name such as editor (a-z, 0-9, _ or -, at most 32)",
        "- options.roles.1: must be a role name such as editor (a-z, 0-9, _ or -, at most 32)",
        "- options.adminEmails.0: must be an email address",
      ].join("\n"),
    );
  });

  it("stores admin emails trimmed and lowercased", () => {
    expect(auth({ adminEmails: [" Owner@Example.COM "] }).options).toMatchObject({ adminEmails: ["owner@example.com"] });
  });

  describe("adminEmails as the raw environment string (#314)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("splits on commas and whitespace, trims and lowercases, without a log line when every entry is valid", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(auth({ adminEmails: " Owner@Example.COM, ada@example.com\n bob@example.com ,," }).options).toMatchObject({
        adminEmails: ["owner@example.com", "ada@example.com", "bob@example.com"],
      });
      expect(warn).not.toHaveBeenCalled();
    });

    it("drops invalid entries with one log line that names their positions, not their values", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(auth({ adminEmails: "owner@example.com,not-an-email,ada@example.com,bad@" }).options).toMatchObject({
        adminEmails: ["owner@example.com", "ada@example.com"],
      });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        "@softure-ai/auth: adminEmails: 2 of 4 entries are not email addresses and grant no role (positions 2, 4)",
      );
    });

    it("grants nothing for an empty or wholly invalid string", () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(auth({ adminEmails: "" }).options).toMatchObject({ adminEmails: [] });
      expect(auth({ adminEmails: "   " }).options).toMatchObject({ adminEmails: [] });
      expect(auth({ adminEmails: "admin" }).options).toMatchObject({ adminEmails: [] });
    });

    it("makes a listed account an admin", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const test = await createTestAuth({ auth: { adminEmails: "nobody, ADA@example.com" } });
      try {
        const account = await createTestAccount(test.ctx, { email: "ada@example.com", password: PASSWORD });
        expect(await findUserRoles(test.ctx, account)).toEqual(new Set(["admin"]));
      } finally {
        await test.database.close();
      }
    });
  });
});
