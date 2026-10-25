// @vitest-environment happy-dom
// The OpenID Connect adapter with Next's request scope replaced: cookies live in a map (a set with maxAge 0
// deletes), headers carry the client address, and `redirect` throws with its URL. The fake provider stands in for
// Google between the start action and the callback route.
import { authMessages, getSessionCookie } from "@softure-ai/auth";
import { ChangePasswordPage, LoginPage, oidcCallbackRoute, oidcSignInAction } from "@softure-ai/auth/next";
import { findSessionUser } from "@softure-ai/auth/server";
import { createFakeOidcProvider, type FakeOidcProvider } from "@softure-ai/auth/testing";
import type { SoftureConfig } from "@softure-ai/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestAuth, NOW, type ConfigOptions, type TestAuth } from "./support.js";

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

const en = authMessages.en;
const ORIGIN = "https://app.example.com";
const STATE_COOKIE = "__Host-softure_session_oidc";

let test: TestAuth;
let fake: FakeOidcProvider;

async function setUp(auth: ConfigOptions["auth"] = {}): Promise<void> {
  fake = createFakeOidcProvider({ clock: { now: () => NOW } });
  test = await createTestAuth({ appOrigin: ORIGIN, auth: { ...auth, oidc: { providers: [{ ...fake.definition, name: "Google" }], fetch: fake.fetch } } });
  scope.config = test.config;
  scope.context = { ...test.ctx, env: fake.env };
  scope.cookies.clear();
}

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await test.database.close();
});

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

function callback(url: URL, provider = "fake"): Promise<Response> {
  return oidcCallbackRoute(new Request(url, { headers: { "x-real-ip": "192.0.2.10" } }), { params: Promise.resolve({ provider }) });
}

describe("the OpenID Connect start action and callback route", () => {
  it("sends the browser to the provider, then back to next with a session cookie and no state cookie", async () => {
    await setUp();
    const authorizeUrl = await readRedirect(oidcSignInAction(form({ provider: "fake", next: "/reports" })));
    expect(authorizeUrl).toMatch(/^https:\/\/fake-oidc\.test\/authorize\?/);
    expect(scope.cookies.get(STATE_COOKIE)).toBe(new URL(authorizeUrl).searchParams.get("state"));

    const response = await callback(fake.signIn(authorizeUrl, { subject: "s1", email: "ada@example.com" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/reports`);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(scope.cookies.has(STATE_COOKIE)).toBe(false);
    const token = scope.cookies.get(getSessionCookie(test.config).name) ?? "";
    expect(await findSessionUser(test.ctx, token)).toMatchObject({ email: "ada@example.com" });
  });

  it("goes back to the login page with the error code when the callback did not come from this browser", async () => {
    await setUp();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const authorizeUrl = await readRedirect(oidcSignInAction(form({ provider: "fake" })));
    scope.cookies.clear();
    const response = await callback(fake.signIn(authorizeUrl, { subject: "s1", email: "ada@example.com" }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?oidc_error=auth.oidc_failed`);
    expect(scope.cookies.size).toBe(0);
  });

  it("goes back to the login page, keeping next, when the sign-in cannot start", async () => {
    await setUp();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await readRedirect(oidcSignInAction(form({ provider: "other", next: "/reports" })))).toBe("/login?oidc_error=auth.oidc_failed&next=%2Freports");
    expect(scope.cookies.size).toBe(0);
  });

  it("shows a refused identity on the login page and opens no session", async () => {
    await setUp();
    const authorizeUrl = await readRedirect(oidcSignInAction(form({ provider: "fake" })));
    const response = await callback(fake.signIn(authorizeUrl, { subject: "s1", email: "eve@evil.test" }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?oidc_error=auth.oidc_not_allowed`);
    expect(scope.cookies.has(getSessionCookie(test.config).name)).toBe(false);
  });
});

describe("the login page with OpenID Connect", () => {
  it("shows the provider button, then the divider and the password form", async () => {
    await setUp();
    render(await LoginPage({ searchParams: Promise.resolve({ next: "/reports" }) }));
    expect(screen.getByRole("button", { name: "Sign in with Google" })).not.toBeNull();
    expect(document.querySelector('input[name="provider"]')).toHaveProperty("value", "fake");
    expect(document.querySelectorAll('input[name="next"][value="/reports"]')).toHaveLength(2);
    expect(screen.getByText(en.oidc.divider)).not.toBeNull();
    expect(document.querySelector('input[name="password"]')).not.toBeNull();
  });

  it("shows only the provider buttons with passwords off, and a failed sign-in's message", async () => {
    await setUp({ password: { enabled: false } });
    render(await LoginPage({ searchParams: Promise.resolve({ oidc_error: "auth.oidc_not_allowed" }) }));
    expect(screen.getByRole("button", { name: "Sign in with Google" })).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(en.errors.auth.oidc_not_allowed);
    expect(document.querySelector('input[name="password"]')).toBeNull();
    expect(screen.queryByText(en.oidc.divider)).toBeNull();
    expect(screen.queryByRole("link", { name: en.login.registerLink })).toBeNull();
  });

  it("shows no text of its own for an error parameter auth did not write", async () => {
    await setUp();
    render(await LoginPage({ searchParams: Promise.resolve({ oidc_error: "<b>call 555</b>" }) }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has no change-password page with passwords off", async () => {
    await setUp({ password: { enabled: false } });
    await expect(ChangePasswordPage()).rejects.toThrow("test: notFound");
  });
});
