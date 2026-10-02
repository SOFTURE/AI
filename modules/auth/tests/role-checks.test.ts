// requireRole, authorizeRole and hasRole with Next's request scope replaced: the session cookie
// comes from a stubbed `cookies()`, the config and the database from the test.
import { ADMIN_ROLE, getSessionCookie } from "@softure-ai/auth";
import { authorizeRole, hasRole, requireRole } from "@softure-ai/auth/next";
import { grantRole, registerUser } from "@softure-ai/auth/server";
import type { SoftureConfig } from "@softure-ai/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestAuth, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  context: unknown;
  readonly cookies: Map<string, string>;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, context: undefined, cookies: new Map() }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => (scope.cookies.has(name) ? { name, value: scope.cookies.get(name) } : undefined) }),
}));
vi.mock("../src/next/context.ts", () => ({ getAuthContext: () => Promise.resolve(scope.context) }));

describe("role checks in the Next adapter", () => {
  let test: TestAuth;

  async function setUp(options: ConfigOptions = {}): Promise<{ userId: string; token: string }> {
    test = await createTestAuth(options);
    scope.config = test.config;
    scope.context = test.ctx;
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    return { userId: registered.value.user.id, token: registered.value.session.token };
  }

  function signIn(token: string): void {
    scope.cookies.set(getSessionCookie(test.config).name, token);
  }

  afterEach(async () => {
    scope.cookies.clear();
    await test.database.close();
  });

  it("closes admin surfaces to an anonymous visitor: not found, forbidden, false", async () => {
    await setUp();
    await expect(requireRole(ADMIN_ROLE)).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(await authorizeRole(ADMIN_ROLE)).toEqual({ ok: false, error: "auth.forbidden" });
    expect(await hasRole(ADMIN_ROLE)).toBe(false);
  });

  it("closes them to a signed-in user without the role when no admin is configured", async () => {
    const { token } = await setUp();
    signIn(token);
    await expect(requireRole(ADMIN_ROLE)).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(await authorizeRole(ADMIN_ROLE)).toEqual({ ok: false, error: "auth.forbidden" });
    expect(await hasRole(ADMIN_ROLE)).toBe(false);
  });

  it("opens them to a user with a stored role", async () => {
    const { userId, token } = await setUp();
    await grantRole(test.ctx, { userId, role: ADMIN_ROLE });
    signIn(token);
    expect((await requireRole(ADMIN_ROLE)).id).toBe(userId);
    expect(await authorizeRole(ADMIN_ROLE)).toMatchObject({ ok: true, value: { id: userId } });
    expect(await hasRole(ADMIN_ROLE)).toBe(true);
  });

  it("opens them to the account of a listed admin email", async () => {
    const { userId, token } = await setUp({ auth: { adminEmails: ["ada@example.com"] } });
    signIn(token);
    expect((await requireRole(ADMIN_ROLE)).id).toBe(userId);
  });

  it("keeps a user with another role out", async () => {
    const { userId, token } = await setUp({ auth: { roles: ["editor"] } });
    await grantRole(test.ctx, { userId, role: "editor" });
    signIn(token);
    expect(await hasRole("editor")).toBe(true);
    expect(await authorizeRole(ADMIN_ROLE)).toEqual({ ok: false, error: "auth.forbidden" });
  });

  it("throws for an undeclared role instead of answering", async () => {
    const { token } = await setUp();
    signIn(token);
    await expect(requireRole("amdin")).rejects.toThrow('role "amdin" is not declared');
    await expect(authorizeRole("amdin")).rejects.toThrow('role "amdin" is not declared');
    await expect(hasRole("amdin")).rejects.toThrow('role "amdin" is not declared');
  });
});
