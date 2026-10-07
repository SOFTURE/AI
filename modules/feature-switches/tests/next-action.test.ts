// The panel's server action with Next's request scope replaced: the session cookie comes from a stubbed
// `cookies()`, `revalidatePath` is recorded, and the app's config hands the test PGlite to the adapter
// through `database.handle`, so the real role check and the real store run.
import { getSessionCookie } from "@softure-ai/auth";
import { grantRole, registerUser } from "@softure-ai/auth/server";
import { defineSoftureConfig, type SoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeConfiguredDatabases, createPgliteHandle } from "@softure-ai/db";
import { featureSwitches } from "@softure-ai/feature-switches";
import { setSwitchAction } from "@softure-ai/feature-switches/next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestSwitches, listRows, NOW, SWITCHES, type TestSwitches } from "./support.js";

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

const IDLE = { status: "idle", isEnabled: false } as const;

function createForm(fields: Readonly<Record<string, string>>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

/** The test config with a panel route override, as an app that mounts its own panel page passes it. */
function createConfigWithPanelAt(panel: string): SoftureConfig {
  const base = createConfig();
  return defineSoftureConfig({
    ...base,
    modules: base.modules.map((module) => (module.id === "feature-switches" ? featureSwitches({ switches: SWITCHES, routes: { panel } }) : module)),
  });
}

describe("setSwitchAction", () => {
  let test: TestSwitches;
  let adminId: string;

  async function start(config: SoftureConfig = createConfig()): Promise<void> {
    test = await createTestSwitches(config);
    const registered = await registerUser(test.ctx, { email: "grace@example.com", password: "correct horse battery", hasConsented: true, clientKey: "ip:203.0.113.7" });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    adminId = registered.value.user.id;
    const granted = await grantRole(test.ctx, { userId: adminId, role: "admin" });
    if (!granted.ok) throw new Error(`setup: granting the admin role failed with ${granted.error}`);
    scope.cookies.set(getSessionCookie(config).name, registered.value.session.token);
    const client = test.database.client;
    registerSoftureConfig(defineSoftureConfig({ ...config, database: { url: "pglite://", handle: () => createPgliteHandle(client) } }));
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  });
  afterEach(async () => {
    scope.cookies.clear();
    scope.revalidated.length = 0;
    vi.useRealTimers();
    clearSoftureConfig();
    // The configured handle wraps the test PGlite, so closing it closes the test database too.
    await closeConfiguredDatabases();
  });

  it("stores the value and revalidates the panel route", async () => {
    await start();
    expect(await setSwitchAction(IDLE, createForm({ name: "billing.checkout_enabled", enabled: "on" }))).toEqual({ status: "ok", isEnabled: true });
    expect(await listRows(test.database)).toEqual([`billing.checkout_enabled true ${adminId}`]);
    expect(scope.revalidated).toEqual(["/admin/switches"]);
  });

  it("revalidates the panel route the app configured", async () => {
    await start(createConfigWithPanelAt("/settings/switches"));
    expect(await setSwitchAction(IDLE, createForm({ name: "billing.checkout_enabled" }))).toEqual({ status: "ok", isEnabled: false });
    expect(scope.revalidated).toEqual(["/settings/switches"]);
  });

  it("revalidates nothing when the caller has no session", async () => {
    await start();
    scope.cookies.clear();
    expect(await setSwitchAction(IDLE, createForm({ name: "billing.checkout_enabled", enabled: "on" }))).toEqual({
      status: "error",
      error: "auth.forbidden",
      isEnabled: false,
    });
    expect(scope.revalidated).toEqual([]);
  });

  it("revalidates nothing when the switch is not declared", async () => {
    await start();
    expect(await setSwitchAction(IDLE, createForm({ name: "app.missing", enabled: "on" }))).toEqual({
      status: "error",
      error: "feature-switches.unknown_switch",
      isEnabled: false,
    });
    expect(scope.revalidated).toEqual([]);
    expect(await listRows(test.database)).toEqual([]);
  });
});
