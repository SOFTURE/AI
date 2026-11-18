// The Next adapter for connections a user owns, with Next's request scope replaced: the session cookie comes from a stubbed `cookies()`,
// `redirect` and `revalidatePath` are recorded, and the app's config hands the test PGlite to the adapter
// through `database.handle`, so the real role check, the real flow and the real store run.
import { getSessionCookie } from "@softure-ai/auth";
import { grantRole, registerUser } from "@softure-ai/auth/server";
import { completeConnectionRoute, disconnectOwnAction, getAccessToken, listOwnConnections, startConnectionAction, startOwnConnectionAction } from "@softure-ai/connections/next";
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeConfiguredDatabases, createPgliteHandle } from "@softure-ai/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOwnedProvider, createTestConnections, KEY_PROVIDERS, NOW, type TestConnections } from "./support.js";

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

describe("the Next adapter for connections a user owns", () => {
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
    test = await createTestConnections({
      providers: (fake) => [fake.definition, createOwnedProvider(fake, { id: "drive" }), ...KEY_PROVIDERS],
      connections: { accountReturnPath: "/settings" },
    });
    // The adapter reads the keyring and the client secret from process.env, like an app.
    Object.assign(process.env, test.ctx.env);
    const client = test.database.client;
    registerSoftureConfig(defineSoftureConfig({ ...test.config, database: { url: "pglite://", handle: () => createPgliteHandle(client) } }));
  });
  afterEach(async () => {
    scope.cookies.clear();
    scope.revalidated.length = 0;
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const name of Object.keys(process.env)) if (!(name in envBefore)) delete process.env[name];
    clearSoftureConfig();
    // The configured handle wraps the test PGlite, so closing it closes the test database too.
    await closeConfiguredDatabases();
  });

  async function startOwn(): Promise<URL> {
    const started = await startOwnConnectionAction(IDLE, createForm({ provider: "drive" })).catch((error: unknown) => error);
    if (!(started instanceof RedirectError)) throw new Error(`test: start did not redirect: ${JSON.stringify(started)}`);
    return test.fake.consent(started.url);
  }

  it("connects a signed-in user without a role and lands them on the provider's page", async () => {
    const ada = await signIn("ada@example.com", null);
    const callback = await startOwn();
    const response = await completeConnectionRoute(new Request(callback));
    expect(response.headers.get("location")).toBe("https://app.example.com/settings/drive?connected=drive%2Fdefault");
    expect((await listOwnConnections(ada)).map((view) => `${view.provider} ${view.status}`)).toEqual(["drive connected"]);
    expect((await getAccessToken({ provider: "drive", ownerId: ada })).ok).toBe(true);
    expect(await getAccessToken({ provider: "drive" })).toEqual({ ok: false, error: "connections.wrong_owner" });
  });

  it("sends a failed own connect back to the provider's page with the code", async () => {
    await signIn("ada@example.com", null);
    const callback = await startOwn();
    callback.searchParams.set("code", "forged");
    expect((await completeConnectionRoute(new Request(callback))).headers.get("location")).toBe("https://app.example.com/settings/drive?error=connections.exchange_failed");
  });

  it("keeps a user's authorization from anyone else, an admin included", async () => {
    await signIn("ada@example.com", null);
    const callback = await startOwn();
    await signIn("grace@example.com", "admin");
    expect((await completeConnectionRoute(new Request(callback))).headers.get("location")).toBe("https://app.example.com/admin/connections?error=connections.state_invalid");
    scope.cookies.clear();
    expect((await completeConnectionRoute(new Request(callback))).headers.get("location")).toBe("https://app.example.com/settings?error=auth.forbidden");
  });

  it("refuses the own actions without a session, and on the app's own providers", async () => {
    expect(await startOwnConnectionAction(IDLE, createForm({ provider: "drive" }))).toEqual({ status: "error", error: "auth.forbidden" });
    expect(await disconnectOwnAction(IDLE, createForm({ provider: "drive" }))).toEqual({ status: "error", error: "auth.forbidden" });
    await signIn("ada@example.com", null);
    expect(await startOwnConnectionAction(IDLE, createForm({ provider: "fake" }))).toEqual({ status: "error", error: "connections.wrong_owner" });
    expect(await disconnectOwnAction(IDLE, createForm({ provider: "raindrop" }))).toEqual({ status: "error", error: "connections.wrong_owner" });
    // And the admin's action refuses a provider users own.
    await signIn("grace@example.com", "admin");
    expect(await startConnectionAction(IDLE, createForm({ provider: "drive" }))).toEqual({ status: "error", error: "connections.wrong_owner" });
  });

  it("disconnects the user's own connection and refreshes their page", async () => {
    const ada = await signIn("ada@example.com", null);
    await completeConnectionRoute(new Request(await startOwn()));
    expect(await disconnectOwnAction(IDLE, createForm({ provider: "drive" }))).toEqual({ status: "ok" });
    expect(scope.revalidated).toEqual(["/settings/drive"]);
    expect((await listOwnConnections(ada)).map((view) => view.status)).toEqual(["not_connected"]);
    expect(await disconnectOwnAction(IDLE, createForm({ provider: "drive" }))).toEqual({ status: "error", error: "connections.not_connected" });
  });
});
