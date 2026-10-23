// getAccessToken: a fresh token as stored, a refresh close to expiry under the row's lease (one refresh for
// overlapping callers), rotation, the terminal invalid_grant with the hook once, and retryable failures.
import type { ReconnectRequiredEvent } from "@softure-ai/connections";
import { getAccessToken, listConnections, replaceRejectedToken } from "@softure-ai/connections/server";
import { afterEach, describe, expect, it } from "vitest";
import { connectFake } from "./connect.js";
import { createTestConnections, NOW, readRawRow, type CreateTestConnectionsOptions, type TestConnections } from "./support.js";

const HOUR = 3600_000;

describe("getAccessToken", () => {
  let test: TestConnections;
  let events: ReconnectRequiredEvent[];

  async function setUp(options: CreateTestConnectionsOptions = {}): Promise<void> {
    events = [];
    test = await createTestConnections({
      ...options,
      connections: { onReconnectRequired: (event) => void events.push(event), ...options.connections },
    });
    await connectFake(test);
  }

  afterEach(async () => {
    await test.database.close();
  });

  async function token(): Promise<string> {
    const result = await getAccessToken(test.ctx, { provider: "fake" });
    if (!result.ok) throw new Error(`test: getAccessToken failed with ${result.error}`);
    return result.value.accessToken;
  }

  it("answers the stored token while it is fresh, without calling the provider", async () => {
    await setUp();
    const first = await token();
    test.clock.advance(HOUR - 301_000);
    expect(await token()).toBe(first);
    expect(test.fake.calls.refresh).toBe(0);
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({
      ok: true,
      value: { accessToken: first, tokenType: "Bearer", expiresAt: new Date(NOW.getTime() + HOUR), scopes: ["read", "write"] },
    });
  });

  it("refreshes within refreshSkewSeconds of the expiry and stores the new token, keeping the refresh token", async () => {
    await setUp();
    const first = await token();
    test.clock.advance(HOUR - 300_000);
    const second = await token();
    expect(second).not.toBe(first);
    expect(test.fake.calls.refresh).toBe(1);
    expect(test.fake.calls.lastForm?.get("grant_type")).toBe("refresh_token");
    expect(await readRawRow(test.database, "fake")).toMatchObject({
      refreshed_at: test.clock.now(),
      expires_at: new Date(test.clock.now().getTime() + HOUR),
      has_refresh_token: true,
      lease_id: null,
      lease_until: null,
    });
    // The provider did not rotate, so the next refresh uses the same refresh token, and works.
    test.clock.advance(HOUR);
    expect(await token()).not.toBe(second);
    expect(test.fake.calls.refresh).toBe(2);
  });

  it("refreshes once for overlapping callers; the others wait and read the new token", async () => {
    await setUp();
    test.clock.advance(HOUR);
    test.fake.setDelay(30);
    const results = await Promise.all([1, 2, 3, 4].map(() => getAccessToken(test.ctx, { provider: "fake" })));
    expect(test.fake.calls.refresh).toBe(1);
    const tokens = new Set(results.map((result) => (result.ok ? result.value.accessToken : result.error)));
    expect(tokens.size).toBe(1);
    expect(test.fake.isAccessTokenValid([...tokens][0] ?? "")).toBe(true);
  });

  it("answers refresh_in_progress when the other worker holds the lease past the wait", async () => {
    await setUp({ connections: { refreshWait: { attempts: 2, intervalMs: 1 } } });
    test.clock.advance(HOUR);
    await test.database.client.query("UPDATE connections.accounts SET lease_id = gen_random_uuid(), lease_until = $1", [new Date(test.clock.now().getTime() + 30_000)]);
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.refresh_in_progress" });
    expect(test.fake.calls.refresh).toBe(0);
  });

  it("takes over a lease that ran out (a worker died mid-refresh)", async () => {
    await setUp();
    test.clock.advance(HOUR);
    await test.database.client.query("UPDATE connections.accounts SET lease_id = gen_random_uuid(), lease_until = $1", [test.clock.now()]);
    expect((await getAccessToken(test.ctx, { provider: "fake" })).ok).toBe(true);
    expect(test.fake.calls.refresh).toBe(1);
  });

  it("stores a rotated refresh token, and the spent one is refused by the provider", async () => {
    await setUp({ fake: { rotatesRefreshToken: true } });
    test.clock.advance(HOUR);
    await token();
    const spent = test.fake.calls.lastForm?.get("refresh_token");
    test.clock.advance(HOUR);
    await token();
    expect(test.fake.calls.lastForm?.get("refresh_token")).not.toBe(spent);
    expect(test.fake.calls.refresh).toBe(2);
    expect(events).toEqual([]);
  });

  it("turns invalid_grant into reconnect_required, runs the hook once and calls the provider no more", async () => {
    await setUp();
    test.fake.revokeGrant();
    test.clock.advance(HOUR);
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.reconnect_required" });
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.reconnect_required" });
    expect(test.fake.calls.refresh).toBe(1);
    expect(events).toEqual([{ provider: "fake", accountId: "default", kind: "oauth", reason: "invalid_grant", at: test.clock.now() }]);
    expect(await readRawRow(test.database, "fake")).toMatchObject({ status: "reconnect_required", last_error: "connections.reconnect_required", lease_id: null });
    expect((await listConnections(test.ctx))[0]?.status).toBe("reconnect_required");
    // A new connect brings it back.
    await connectFake(test);
    expect((await getAccessToken(test.ctx, { provider: "fake" })).ok).toBe(true);
  });

  it("keeps the connection on retryable failures, records the last one and retries on the next call", async () => {
    await setUp();
    test.clock.advance(HOUR);
    for (const failure of ["unavailable", "rate_limited", "unreachable", "malformed", "redirect"] as const) {
      test.fake.failNext(failure);
      expect(await getAccessToken(test.ctx, { provider: "fake" }), failure).toEqual({ ok: false, error: "connections.refresh_failed" });
    }
    expect(await readRawRow(test.database, "fake")).toMatchObject({ status: "connected", last_error: "connections.refresh_failed", lease_id: null });
    expect((await getAccessToken(test.ctx, { provider: "fake" })).ok).toBe(true);
    expect(await readRawRow(test.database, "fake")).toMatchObject({ last_error: null, last_error_at: null });
    expect(events).toEqual([]);
  });

  it("answers client_rejected when the provider refuses the client, without needing a reconnect", async () => {
    await setUp();
    test.clock.advance(HOUR);
    test.fake.failNext("invalid_client");
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.client_rejected" });
    expect(await readRawRow(test.database, "fake")).toMatchObject({ status: "connected", last_error: "connections.client_rejected" });
  });

  it("answers a token that never expires as it is", async () => {
    await setUp({ fake: { accessTokenTtlSeconds: null, issuesRefreshToken: false } });
    const first = await token();
    test.clock.advance(365 * 24 * HOUR);
    expect(await token()).toBe(first);
    expect((await listConnections(test.ctx))[0]?.status).toBe("connected");
  });

  it("uses a token without a refresh token until it expires, then needs a reconnect (hook once)", async () => {
    await setUp({ fake: { issuesRefreshToken: false } });
    test.clock.advance(HOUR - 60_000);
    expect((await getAccessToken(test.ctx, { provider: "fake" })).ok).toBe(true);
    test.clock.advance(60_000);
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.reconnect_required" });
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.reconnect_required" });
    expect(events.map((event) => event.reason)).toEqual(["expired"]);
    expect(test.fake.calls.refresh).toBe(0);
  });

  it("keeps the state when the hook throws, and logs only the kind", async () => {
    events = [];
    test = await createTestConnections({
      connections: {
        onReconnectRequired: () => {
          throw new Error("mail down: secret-token-in-message");
        },
      },
    });
    await connectFake(test);
    test.fake.revokeGrant();
    test.clock.advance(HOUR);
    const logged: string[] = [];
    const original = console.error;
    console.error = (line: string) => void logged.push(line);
    try {
      expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.reconnect_required" });
    } finally {
      console.error = original;
    }
    expect(logged).toEqual(["@softure-ai/connections: the onReconnectRequired hook failed: Error"]);
  });

  it("forceRefresh refreshes a fresh token under the lease and stores the new one", async () => {
    await setUp();
    const first = await token();
    const forced = await getAccessToken(test.ctx, { provider: "fake", forceRefresh: true });
    if (!forced.ok) throw new Error(`test: forced refresh failed with ${forced.error}`);
    expect(forced.value.accessToken).not.toBe(first);
    expect(test.fake.calls.refresh).toBe(1);
    expect(await token()).toBe(forced.value.accessToken);
    expect(await readRawRow(test.database, "fake")).toMatchObject({ refreshed_at: test.clock.now(), lease_id: null, lease_until: null });
  });

  it("forceRefresh refreshes once for overlapping callers", async () => {
    await setUp();
    test.fake.setDelay(30);
    const results = await Promise.all([1, 2, 3].map(() => getAccessToken(test.ctx, { provider: "fake", forceRefresh: true })));
    expect(test.fake.calls.refresh).toBe(1);
    expect(new Set(results.map((result) => (result.ok ? result.value.accessToken : result.error))).size).toBe(1);
  });

  it("forceRefresh turns invalid_grant into reconnect_required with the hook once", async () => {
    await setUp();
    test.fake.revokeGrant();
    expect(await getAccessToken(test.ctx, { provider: "fake", forceRefresh: true })).toEqual({ ok: false, error: "connections.reconnect_required" });
    expect(events.map((event) => event.reason)).toEqual(["invalid_grant"]);
  });

  it("forceRefresh keeps the connection on a retryable failure", async () => {
    await setUp();
    test.fake.failNext("unavailable");
    expect(await getAccessToken(test.ctx, { provider: "fake", forceRefresh: true })).toEqual({ ok: false, error: "connections.refresh_failed" });
    expect(await readRawRow(test.database, "fake")).toMatchObject({ status: "connected", last_error: "connections.refresh_failed", lease_id: null });
  });

  it("forceRefresh answers the stored token when there is no refresh token", async () => {
    await setUp({ fake: { issuesRefreshToken: false } });
    const first = await token();
    expect(await token()).toBe(first);
    const forced = await getAccessToken(test.ctx, { provider: "fake", forceRefresh: true });
    expect(forced.ok && forced.value.accessToken).toBe(first);
    expect(test.fake.calls.refresh).toBe(0);
    expect(events).toEqual([]);
  });

  it("replaceRejectedToken refreshes only while the stored token is the refused one", async () => {
    await setUp();
    const first = await token();
    const replaced = await replaceRejectedToken(test.ctx, { provider: "fake", rejectedToken: first });
    if (!replaced.ok) throw new Error(`test: replace failed with ${replaced.error}`);
    expect(replaced.value.accessToken).not.toBe(first);
    // A second caller that saw the same 401 reads the replacement instead of refreshing again.
    expect(await replaceRejectedToken(test.ctx, { provider: "fake", rejectedToken: first })).toEqual(replaced);
    expect(test.fake.calls.refresh).toBe(1);
  });

  it("answers codes for what it cannot serve", async () => {
    await setUp();
    expect(await getAccessToken(test.ctx, { provider: "nope" })).toEqual({ ok: false, error: "connections.unknown_provider" });
    expect(await getAccessToken(test.ctx, { provider: "raindrop" })).toEqual({ ok: false, error: "connections.wrong_kind" });
    expect(await getAccessToken({ ...test.ctx, env: {} }, { provider: "fake" })).toEqual({ ok: false, error: "connections.key_missing" });
    await test.database.client.query("DELETE FROM connections.accounts");
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.not_connected" });
  });

  it("answers key_unknown after the sealing key left the keyring", async () => {
    await setUp();
    const { createTestKeyring } = await import("@softure-ai/connections/testing");
    expect(await getAccessToken({ ...test.ctx, env: { ...test.ctx.env, ...createTestKeyring(["other"]) } }, { provider: "fake" })).toEqual({
      ok: false,
      error: "connections.key_unknown",
    });
  });

  it("reports the refresh token's end from the provider and shows the connection as expiring near it", async () => {
    await setUp({ fake: { refreshTokenTtlSeconds: 7 * 24 * 3600 } });
    expect(await readRawRow(test.database, "fake")).toMatchObject({ refresh_expires_at: new Date(NOW.getTime() + 7 * 24 * HOUR) });
    expect((await listConnections(test.ctx))[0]?.status).toBe("connected");
    test.clock.advance(4 * 24 * HOUR + 1);
    expect((await listConnections(test.ctx))[0]?.status).toBe("expiring");
    test.clock.advance(3 * 24 * HOUR);
    expect((await listConnections(test.ctx))[0]?.status).toBe("reconnect_required");
  });
});
