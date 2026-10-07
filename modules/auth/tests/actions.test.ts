// The server actions with Next's request scope replaced: cookies live in a map (a set with
// maxAge 0 deletes), headers carry the client address, and `redirect` throws with its URL.
import { getSessionCookie, sessions, type OnRegisteredHook } from "@softure-ai/auth";
import { loginAction, logoutAction, registerAction } from "@softure-ai/auth/next";
import { findSessionUser, registerUser } from "@softure-ai/auth/server";
import type { SoftureConfig } from "@softure-ai/core";
import { createHash, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAY_MS, NOW, PASSWORD, createTestAuth, type ConfigOptions, type TestAuth } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  context: unknown;
  readonly cookies: Map<string, string>;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, context: undefined, cookies: new Map() }));

class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`redirect to ${url}`);
  }
}

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (scope.cookies.has(name) ? { name, value: scope.cookies.get(name) } : undefined),
      set: (name: string, value: string, options: { maxAge?: number }) => {
        if (options.maxAge === 0) scope.cookies.delete(name);
        else scope.cookies.set(name, value);
      },
    }),
  headers: () => Promise.resolve(new Headers({ "x-real-ip": "192.0.2.10" })),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("test: notFound");
  },
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("../src/next/context.ts", () => ({ getAuthContext: () => Promise.resolve(scope.context) }));

const EMAIL = "ada@example.com";
const LEGACY = { cookieName: "session", tokenPattern: /[0-9a-f]{64}/ };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

async function readRedirect(call: Promise<unknown>): Promise<string> {
  const error: unknown = await call.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof RedirectError)) throw new Error(`expected a redirect, got ${String(error)}`);
  return error.url;
}

describe("auth actions", () => {
  let test: TestAuth;

  async function setUp(options: ConfigOptions = {}): Promise<TestAuth> {
    test = await createTestAuth(options);
    scope.config = test.config;
    scope.context = test.ctx;
    scope.cookies.clear();
    return test;
  }

  async function plantLegacySession(userId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    await test.database.db.insert(sessions).values({ tokenHash, userId, createdAt: NOW, expiresAt: new Date(NOW.getTime() + DAY_MS) });
    scope.cookies.set(LEGACY.cookieName, token);
    return token;
  }

  afterEach(async () => {
    await test.database.close();
  });

  describe("with a legacy session", () => {
    it("ends the legacy session at login and leaves only the new cookie", async () => {
      await setUp({ auth: { legacySession: LEGACY } });
      const registered = await registerUser(test.ctx, { email: EMAIL, password: PASSWORD, hasConsented: true, clientKey: "ip:198.51.100.1" });
      if (!registered.ok) throw new Error("setup failed");
      const legacy = await plantLegacySession(registered.value.user.id);

      expect(await readRedirect(loginAction({ status: "idle" }, form({ email: EMAIL, password: PASSWORD, next: "/account" })))).toBe("/account");
      expect(await findSessionUser(test.ctx, legacy)).toBeNull();
      expect([...scope.cookies.keys()]).toEqual([getSessionCookie(test.config).name]);
    });

    it("ends both sessions at logout and clears both cookies", async () => {
      await setUp({ auth: { legacySession: LEGACY } });
      const registered = await registerUser(test.ctx, { email: EMAIL, password: PASSWORD, hasConsented: true, clientKey: "ip:198.51.100.1" });
      if (!registered.ok) throw new Error("setup failed");
      const legacy = await plantLegacySession(registered.value.user.id);
      scope.cookies.set(getSessionCookie(test.config).name, registered.value.session.token);

      expect(await readRedirect(logoutAction())).toBe("/login");
      expect(await findSessionUser(test.ctx, legacy)).toBeNull();
      expect(await findSessionUser(test.ctx, registered.value.session.token)).toBeNull();
      expect(scope.cookies.size).toBe(0);
    });
  });

  it("sends a login to a next path of several thousand characters whole", async () => {
    await setUp();
    const registered = await registerUser(test.ctx, { email: EMAIL, password: PASSWORD, hasConsented: true, clientKey: "ip:198.51.100.1" });
    if (!registered.ok) throw new Error("setup failed");
    const next = `/oauth/authorize?state=${"s".repeat(6000)}`;
    expect(await readRedirect(loginAction({ status: "idle" }, form({ email: EMAIL, password: PASSWORD, next })))).toBe(next);
  });

  it("hands only the declared registration fields of the form to onRegistered", async () => {
    const onRegistered = vi.fn<OnRegisteredHook>(() => Promise.resolve());
    await setUp({ auth: { registrationFields: ["z"], onRegistered } });
    const data = form({ email: EMAIL, password: PASSWORD, consent: "on", next: "/", z: "newsletter", role: "admin" });
    data.append("upload", new Blob(["x"]), "x.txt");
    expect(await readRedirect(registerAction({ status: "idle" }, data))).toBe("/");
    expect(onRegistered).toHaveBeenCalledWith(expect.objectContaining({ fields: { z: "newsletter" } }), expect.anything());
  });

  it("ignores a declared field sent as a file", async () => {
    const onRegistered = vi.fn<OnRegisteredHook>(() => Promise.resolve());
    await setUp({ auth: { registrationFields: ["z"], onRegistered } });
    const data = form({ email: EMAIL, password: PASSWORD, consent: "on" });
    data.append("z", new Blob(["x"]), "z.txt");
    expect(await readRedirect(registerAction({ status: "idle" }, data))).toBe("/");
    expect(onRegistered).toHaveBeenCalledWith(expect.objectContaining({ fields: {} }), expect.anything());
  });
});
