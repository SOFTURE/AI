// requireUser's redirect to the login page with Next's request scope replaced: the session cookie
// comes from a stubbed `cookies()`, and `redirect` throws with its URL, so the tests read the target
// without Next's internal digest. The app's `rewriteRedirect` gets the page's search params when the
// page passes them (e.g. analytics' `tagRedirect` keeps the channel tag), and never sends the visitor
// elsewhere.
import { getSessionCookie, type RewriteRedirect } from "@softure-ai/auth";
import { requireUser } from "@softure-ai/auth/next";
import { registerUser } from "@softure-ai/auth/server";
import type { SoftureConfig } from "@softure-ai/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createConfig, createTestAuth, PASSWORD, type ConfigOptions } from "./support.js";

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
  cookies: () => Promise.resolve({ get: (name: string) => (scope.cookies.has(name) ? { name, value: scope.cookies.get(name) } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("test: notFound");
  },
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));
vi.mock("../src/next/context.ts", () => ({ getAuthContext: () => Promise.resolve(scope.context) }));

/** The URL `requireUser` redirected to; fails the test when it returned instead. */
async function readRedirect(call: Promise<unknown>): Promise<string> {
  const error: unknown = await call.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof RedirectError)) throw new Error(`test: expected a redirect, got ${String(error)}`);
  return error.url;
}

function useConfig(options: ConfigOptions = {}): SoftureConfig {
  scope.config = createConfig(options);
  return scope.config;
}

afterEach(() => {
  scope.cookies.clear();
  scope.config = undefined;
  scope.context = undefined;
  vi.restoreAllMocks();
});

describe("requireUser without a session", () => {
  it("redirects to the login page, with next when given, without a rewrite", async () => {
    useConfig();
    expect(await readRedirect(requireUser())).toBe("/login");
    expect(await readRedirect(requireUser({ next: "/payment?plan=monthly" }))).toBe("/login?next=%2Fpayment%3Fplan%3Dmonthly");
    expect(await readRedirect(requireUser({ next: "/payment", searchParams: { z: "ads" } }))).toBe("/login?next=%2Fpayment");
  });

  it("hands a page's search params to the rewrite, every value of a repeated name kept", async () => {
    const rewriteRedirect = vi.fn<RewriteRedirect>((path) => `${path}&z=ads`);
    const config = useConfig({ auth: { rewriteRedirect } });
    const url = await readRedirect(requireUser({ next: "/payment", searchParams: { plan: "monthly", z: ["ads", "mail"], empty: undefined } }));
    expect(url).toBe("/login?next=%2Fpayment&z=ads");
    expect(rewriteRedirect).toHaveBeenCalledExactlyOnceWith("/login?next=%2Fpayment", { config, searchParams: new URLSearchParams("plan=monthly&z=ads&z=mail") });
  });

  it("accepts URLSearchParams as they are", async () => {
    const rewriteRedirect = vi.fn<RewriteRedirect>((path) => `${path}?z=ads`);
    const config = useConfig({ auth: { rewriteRedirect } });
    const searchParams = new URLSearchParams("z=ads");
    expect(await readRedirect(requireUser({ searchParams }))).toBe("/login?z=ads");
    expect(rewriteRedirect).toHaveBeenCalledExactlyOnceWith("/login", { config, searchParams });
  });

  it("hands the rewrite the config alone without search params, as for an action", async () => {
    const rewriteRedirect = vi.fn<RewriteRedirect>((path) => path);
    useConfig({ auth: { rewriteRedirect } });
    expect(await readRedirect(requireUser({ next: "/payment" }))).toBe("/login?next=%2Fpayment");
    expect(Object.keys(rewriteRedirect.mock.calls[0]?.[1] ?? {})).toEqual(["config"]);
  });

  it("keeps the login path when the rewrite leaves the app or fails", async () => {
    useConfig({ auth: { rewriteRedirect: () => "https://evil.example.com/login" } });
    expect(await readRedirect(requireUser({ next: "/payment", searchParams: { z: "ads" } }))).toBe("/login?next=%2Fpayment");

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useConfig({
      auth: {
        rewriteRedirect: () => {
          throw new TypeError("broken rewrite");
        },
      },
    });
    expect(await readRedirect(requireUser({ searchParams: { z: "ads" } }))).toBe("/login");
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

describe("requireUser with a session", () => {
  it("returns the user and rewrites nothing", async () => {
    const rewriteRedirect = vi.fn<RewriteRedirect>((path) => path);
    const test = await createTestAuth({ auth: { rewriteRedirect } });
    try {
      scope.config = test.config;
      scope.context = test.ctx;
      const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
      if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
      scope.cookies.set(getSessionCookie(test.config).name, registered.value.session.token);
      expect((await requireUser({ next: "/payment", searchParams: { z: "ads" } })).id).toBe(registered.value.user.id);
      expect(rewriteRedirect).not.toHaveBeenCalled();
    } finally {
      await test.database.close();
    }
  });
});
