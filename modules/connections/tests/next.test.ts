// The Next adapter with Next's request scope replaced: the session cookie comes from a stubbed `cookies()`,
// `redirect` and `revalidatePath` are recorded, and the app's config hands the test PGlite to the adapter
// through `database.handle`, so the real role check, the real flow and the real store run.
import { getSessionCookie } from "@softure-ai/auth";
import { grantRole, registerUser } from "@softure-ai/auth/server";
import { completeConnectionRoute, disconnectAction, getAccessToken, getCredential, readPageNotice, saveCredentialAction, startConnectionAction } from "@softure-ai/connections/next";
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeConfiguredDatabases, createPgliteHandle } from "@softure-ai/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestConnections, listRows, NOW, type TestConnections } from "./support.js";

class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`test: redirect to ${url}`);
  }
}

const scope = vi.hoisted(() => ({ cookies: new Map<string, string>(), revalidated: [] as string[] }));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => (scope.cookies.has(name) ? { name, value: scope.cookies.get(name) } : undefined) }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    scope.revalidated.push(path);
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("test: notFound");
  },
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

const IDLE = { status: "idle" } as const;

function createForm(fields: Readonly<Record<string, string>>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

describe("the Next adapter", () => {
  let test: TestConnections;
  const envBefore = { ...process.env };

  async function signIn(email: string, role: string | null): Promise<string> {
    const registered = await registerUser(test.ctx, { email, password: "correct horse battery", hasConsented: true, clientKey: "ip:203.0.113.7" });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    if (role !== null) await grantRole(test.ctx, { userId: registered.value.user.id, role });
    scope.cookies.set(getSessionCookie(test.config).name, registered.value.session.token);
    return registered.value.user.id;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    test = await createTestConnections();
    // The adapter reads the keyring and the client secret from process.env, like an app.
    Object.assign(process.env, test.ctx.env);
    const client = test.database.client;
    registerSoftureConfig(defineSoftureConfig({ ...test.config, database: { url: "pglite://", handle: () => createPgliteHandle(client) } }));
  });
  afterEach(async () => {
    scope.cookies.clear();
    scope.revalidated.length = 0;
    vi.useRealTimers();
    for (const name of Object.keys(process.env)) if (!(name in envBefore)) delete process.env[name];
    clearSoftureConfig();
    // The configured handle wraps the test PGlite, so closing it closes the test database too.
    await closeConfiguredDatabases();
  });

  async function startAndConsent(): Promise<URL> {
    const started = await startConnectionAction(IDLE, createForm({ provider: "fake", account: "default" })).catch((error: unknown) => error);
    if (!(started instanceof RedirectError)) throw new Error(`test: start did not redirect: ${JSON.stringify(started)}`);
    return test.fake.consent(started.url);
  }

  it("connects through the action and the callback route, landing on the page with a notice", async () => {
    await signIn("grace@example.com", "admin");
    const callback = await startAndConsent();
    const response = await completeConnectionRoute(new Request(callback));
    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.toString()).toBe("https://app.example.com/admin/connections?connected=fake%2Fdefault");
    expect(readPageNotice(location.searchParams)).toEqual({ kind: "connected", provider: "fake", accountId: "default" });
    expect(await listRows(test.database)).toEqual(["fake/default connected oauth test"]);
    expect((await getAccessToken({ provider: "fake" })).ok).toBe(true);
  });

  it("lands on the page with the code when the callback fails, never the provider's text", async () => {
    await signIn("grace@example.com", "admin");
    const callback = await startAndConsent();
    callback.searchParams.set("code", "forged");
    const response = await completeConnectionRoute(new Request(callback));
    expect(response.headers.get("location")).toBe("https://app.example.com/admin/connections?error=connections.exchange_failed");
    const denied = new URL(callback);
    denied.searchParams.delete("code");
    denied.searchParams.set("error", "access_denied");
    denied.searchParams.set("error_description", "<script>");
    expect((await completeConnectionRoute(new Request(denied))).headers.get("location")).toBe("https://app.example.com/admin/connections?error=connections.state_invalid");
  });

  it("refuses the start and the callback to anyone without the role", async () => {
    await signIn("grace@example.com", "admin");
    const callback = await startAndConsent();
    scope.cookies.clear();
    expect(await startConnectionAction(IDLE, createForm({ provider: "fake" }))).toEqual({ status: "error", error: "auth.forbidden" });
    expect((await completeConnectionRoute(new Request(callback))).headers.get("location")).toBe("https://app.example.com/admin/connections?error=auth.forbidden");
    await signIn("bob@example.com", null);
    expect((await completeConnectionRoute(new Request(callback))).headers.get("location")).toBe("https://app.example.com/admin/connections?error=auth.forbidden");
    expect(await listRows(test.database)).toEqual([]);
  });

  it("answers the start's refusals as form states", async () => {
    await signIn("grace@example.com", "admin");
    expect(await startConnectionAction(IDLE, createForm({ provider: "raindrop" }))).toEqual({ status: "error", error: "connections.wrong_kind" });
    expect(await startConnectionAction(IDLE, createForm({ provider: "x".repeat(500) }))).toEqual({ status: "error", error: "connections.unknown_provider" });
  });

  it("saves a key, reads it back for request code, and disconnects, revalidating the page each time", async () => {
    await signIn("grace@example.com", "admin");
    expect(await saveCredentialAction(IDLE, createForm({ provider: "raindrop", kind: "api_key", apiKey: "rd-key" }))).toEqual({ status: "ok" });
    expect(await getCredential({ provider: "raindrop" })).toEqual({ ok: true, value: { kind: "api_key", apiKey: "rd-key" } });
    expect(await saveCredentialAction(IDLE, createForm({ provider: "toggl", account: "work", kind: "basic", username: "ada", password: "pw" }))).toEqual({ status: "ok" });
    expect(await saveCredentialAction(IDLE, createForm({ provider: "raindrop", kind: "api_key", apiKey: "" }))).toEqual({ status: "error", error: "connections.credential_invalid" });
    expect(await disconnectAction(IDLE, createForm({ provider: "raindrop" }))).toEqual({ status: "ok" });
    expect(await disconnectAction(IDLE, createForm({ provider: "raindrop" }))).toEqual({ status: "error", error: "connections.not_connected" });
    expect(scope.revalidated).toEqual(["/admin/connections", "/admin/connections", "/admin/connections"]);
    expect(await listRows(test.database)).toEqual(["toggl/work connected basic test"]);
    scope.cookies.clear();
    expect(await saveCredentialAction(IDLE, createForm({ provider: "raindrop", kind: "api_key", apiKey: "x" }))).toEqual({ status: "error", error: "auth.forbidden" });
    expect(await disconnectAction(IDLE, createForm({ provider: "toggl", account: "work" }))).toEqual({ status: "error", error: "auth.forbidden" });
  });
});

describe("readPageNotice", () => {
  it.each([
    ["connected=fake%2Fwork", { kind: "connected", provider: "fake", accountId: "work" }],
    ["error=connections.consent_denied", { kind: "error", code: "connections.consent_denied" }],
    ["error=%3Cscript%3E", { kind: "none" }],
    ["connected=Fake%2Fwork", { kind: "none" }],
    ["connected=fake%2Fwork%2Fextra", { kind: "none" }],
    ["", { kind: "none" }],
  ])("reads %s", (query, notice) => {
    expect(readPageNotice(new URLSearchParams(query))).toEqual(notice);
  });
});
