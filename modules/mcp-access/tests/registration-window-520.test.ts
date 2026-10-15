// Closed dynamic client registration (#520): `oauth.registration: "closed"` keeps
// `POST /api/oauth/register` shut except while a window opened by the ops script lasts.
import { createCloseClientRegistrationScript, createOpenClientRegistrationScript } from "@softure-ai/mcp-access/scripts";
import {
  closeClientRegistration,
  findClientRegistrationWindow,
  getAuthorizationServerMetadata,
  getMcpAccessOptions,
  handleClientRegistration,
  isClientRegistrationOpen,
  openClientRegistration,
} from "@softure-ai/mcp-access/server";
import { createTestClock } from "@softure-ai/core";
import { executeOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT_IP, createConfig, createTestMcp, NOW, OAUTH_OPTIONS, REDIRECT_URI, type TestMcp } from "./support.js";

const ORIGIN = "http://localhost:3000";
const CLOSED = { ...OAUTH_OPTIONS, oauth: { ...OAUTH_OPTIONS.oauth, registration: "closed" as const } };
const MINUTE = 60_000;

function registrationRequest(): Request {
  return new Request(`${ORIGIN}/api/oauth/register`, {
    method: "POST",
    headers: { "x-real-ip": CLIENT_IP, "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Assistant", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" }),
  });
}

describe("the oauth.registration option (#520)", () => {
  it("defaults to open and takes only open or closed", () => {
    expect(getMcpAccessOptions(createConfig(OAUTH_OPTIONS)).oauth.registration).toBe("open");
    expect(getMcpAccessOptions(createConfig(CLOSED)).oauth.registration).toBe("closed");
    expect(() => createConfig({ ...OAUTH_OPTIONS, oauth: { registration: "sometimes" as "open" } })).toThrow(/registration/);
  });
});

describe("closed client registration (#520)", () => {
  let test: TestMcp;

  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  async function countClients(): Promise<number> {
    const result = await test.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM mcp.oauth_clients");
    return result.rows[0]?.count ?? -1;
  }

  async function register(): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await handleClientRegistration(test.ctx, registrationRequest());
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  describe("the window table", () => {
    it("holds one row only, and refuses a window that ends before it opens", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      const insert = (id: number, openedAt: Date, openUntil: Date) =>
        test.database.client.query("INSERT INTO mcp.oauth_registration_window (id, opened_at, open_until) VALUES ($1, $2, $3)", [id, openedAt, openUntil]);
      await insert(1, NOW, new Date(NOW.getTime() + MINUTE));
      await expect(insert(2, NOW, new Date(NOW.getTime() + MINUTE))).rejects.toThrow(/check constraint/);
      await test.database.client.query("DELETE FROM mcp.oauth_registration_window");
      await expect(insert(1, NOW, NOW)).rejects.toThrow(/check constraint/);
    });
  });

  describe("the server functions", () => {
    it("is always open with the default option, whatever the table holds", async () => {
      test = await createTestMcp(createConfig(OAUTH_OPTIONS));
      expect(await isClientRegistrationOpen(test.ctx)).toBe(true);
    });

    it("opens for the given minutes, replaces an open window, and closes", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      expect(await isClientRegistrationOpen(test.ctx)).toBe(false);
      expect(await findClientRegistrationWindow(test.ctx)).toBeNull();

      await openClientRegistration(test.ctx, { minutes: 10 });
      expect(await findClientRegistrationWindow(test.ctx)).toEqual({ openedAt: NOW, openUntil: new Date(NOW.getTime() + 10 * MINUTE) });
      expect(await isClientRegistrationOpen(test.ctx)).toBe(true);

      test.clock.advance(5 * MINUTE);
      await openClientRegistration(test.ctx, { minutes: 1 });
      expect((await findClientRegistrationWindow(test.ctx))?.openUntil).toEqual(new Date(NOW.getTime() + 6 * MINUTE));

      test.clock.advance(MINUTE);
      expect(await isClientRegistrationOpen(test.ctx)).toBe(false);

      await openClientRegistration(test.ctx, { minutes: 1 });
      expect(await closeClientRegistration(test.ctx)).toBe(true);
      expect(await closeClientRegistration(test.ctx)).toBe(false);
      expect(await isClientRegistrationOpen(test.ctx)).toBe(false);
    });

    it("refuses minutes outside 1 to 1440", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      await expect(openClientRegistration(test.ctx, { minutes: 0 })).rejects.toThrow(/1 to 1440/);
      await expect(openClientRegistration(test.ctx, { minutes: 1441 })).rejects.toThrow(/1 to 1440/);
      await expect(openClientRegistration(test.ctx, { minutes: 1.5 })).rejects.toThrow(/1 to 1440/);
    });
  });

  describe("the registration route", () => {
    it("answers 403 access_denied while closed and stores no client", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      const { status, body } = await register();
      expect(status).toBe(403);
      expect(body).toEqual({ error: "access_denied", error_description: "Client registration is closed." });
      expect(await countClients()).toBe(0);
    });

    it("registers inside a window and refuses again once it ends", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      await openClientRegistration(test.ctx, { minutes: 10 });
      expect((await register()).status).toBe(201);
      test.clock.advance(10 * MINUTE);
      expect((await register()).status).toBe(403);
      expect(await countClients()).toBe(1);
    });

    it("still counts a refused registration against the address", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      for (let attempt = 0; attempt < 60; attempt += 1) await register();
      expect((await register()).status).toBe(429);
    });

    it("answers 503 when the window cannot be read, and logs it", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await test.database.client.query("DROP TABLE mcp.oauth_registration_window");
      const { status, body } = await register();
      expect(status).toBe(503);
      expect(body.error).toBe("temporarily_unavailable");
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/reading the client registration window failed/));
    });

    it("keeps registration_endpoint in the discovery document", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      expect(getAuthorizationServerMetadata(test.config).registration_endpoint).toBe(`${ORIGIN}/api/oauth/register`);
    });
  });

  describe("the ops scripts", () => {
    const openScript = () => createOpenClientRegistrationScript(test.config, { clock: createTestClock(NOW) });
    const closeScript = () => createCloseClientRegistrationScript(test.config);

    it("reports the window a dry run would open and writes nothing", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      const outcome = await executeOpsScript(test.database.db, openScript(), { minutes: 15 }, { commit: false });
      expect(outcome).toEqual({
        ok: true,
        value: { committed: false, report: { before: { openUntil: null }, after: { openUntil: "2026-09-15T12:15:00.000Z" } } },
      });
      expect(await findClientRegistrationWindow(test.ctx)).toBeNull();
    });

    it("opens the window with --commit, and closes it", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      await executeOpsScript(test.database.db, openScript(), { minutes: 15 }, { commit: true });
      expect((await findClientRegistrationWindow(test.ctx))?.openUntil).toEqual(new Date(NOW.getTime() + 15 * MINUTE));

      const closed = await executeOpsScript(test.database.db, closeScript(), {}, { commit: true });
      expect(closed).toEqual({
        ok: true,
        value: { committed: true, report: { before: { openUntil: "2026-09-15T12:15:00.000Z" }, after: { openUntil: null } } },
      });
      expect(await findClientRegistrationWindow(test.ctx)).toBeNull();
    });

    it.each([["0"], ["1441"], ["ten"], ["1.5"]])("refuses --minutes=%s by its schema", async (minutes) => {
      test = await createTestMcp(createConfig(CLOSED));
      expect(openScript().args.safeParse({ minutes }).success).toBe(false);
      expect(openScript().args.safeParse({ minutes: "1440" })).toMatchObject({ success: true, data: { minutes: 1440 } });
    });

    it("refuses to close when no window is open", async () => {
      test = await createTestMcp(createConfig(CLOSED));
      const outcome = await executeOpsScript(test.database.db, closeScript(), {}, { commit: true });
      expect(outcome).toMatchObject({ ok: false, error: "ops.script_refused", reason: "client registration has no open window" });
    });

    it.each([
      ["registration is open", OAUTH_OPTIONS, /oauth\.registration is "open"/],
      ["OAuth is off", { ...CLOSED, oauth: { ...CLOSED.oauth, enabled: false } }, /oauth\.enabled is off/],
    ])("both refuse while %s", async (_case, options, reason) => {
      test = await createTestMcp(createConfig(options));
      const opened = await executeOpsScript(test.database.db, createOpenClientRegistrationScript(test.config), { minutes: 5 }, { commit: true });
      const closed = await executeOpsScript(test.database.db, createCloseClientRegistrationScript(test.config), {}, { commit: true });
      for (const outcome of [opened, closed]) {
        expect(outcome).toMatchObject({ ok: false, error: "ops.script_refused", reason: expect.stringMatching(reason) as unknown });
      }
    });
  });
});
