// The authorization code flow against the fake provider: the authorize URL, the one-time state bound to the
// admin who started it, PKCE, the code exchange, and a connection stored with nothing in plain text.
import { completeAuthorization, getAccessToken, listConnections, startAuthorization, type CallbackParams } from "@softure-ai/connections/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADMIN, createTestConnections, listRows, NOW, OTHER_ADMIN, readRawRow, type TestConnections } from "./support.js";

function toParams(url: URL): CallbackParams {
  return { state: url.searchParams.get("state"), code: url.searchParams.get("code"), error: url.searchParams.get("error") };
}

describe("the connect flow", () => {
  let test: TestConnections;

  beforeEach(async () => {
    test = await createTestConnections();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function start(accountId?: string) {
    const started = await startAuthorization(test.ctx, { provider: "fake", ...(accountId === undefined ? {} : { accountId }), actorId: ADMIN });
    if (!started.ok) throw new Error(`test: start failed with ${started.error}`);
    return new URL(started.value.url);
  }

  it("sends the admin to the provider with the client, redirect URI, scopes, state and an S256 challenge", async () => {
    const url = await start();
    expect(`${url.origin}${url.pathname}`).toBe("https://fake-oauth.test/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "fake-client",
      redirect_uri: "https://app.example.com/api/connections/callback",
      scope: "read write",
      state: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
      code_challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
      code_challenge_method: "S256",
    });
  });

  it("stores only the state's hash and a sealed verifier", async () => {
    const url = await start();
    const rows = await test.database.client.query<{ state_hash: string; verifier: string; created_by: string; expires_at: Date }>(
      "SELECT state_hash, verifier, created_by, expires_at FROM connections.oauth_states",
    );
    expect(rows.rows).toHaveLength(1);
    const [row] = rows.rows;
    expect(row?.state_hash).not.toBe(url.searchParams.get("state"));
    expect(row?.verifier.startsWith("v1.test.")).toBe(true);
    expect(row?.created_by).toBe(ADMIN);
    expect(row?.expires_at).toEqual(new Date(NOW.getTime() + 10 * 60_000));
  });

  it("connects: exchanges the code with the verifier and stores the grant sealed", async () => {
    const callback = test.fake.consent((await start()).toString());
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).toEqual({ ok: true, value: { provider: "fake", accountId: "default" } });
    expect(test.fake.calls.authorizationCode).toBe(1);
    expect(test.fake.calls.lastForm?.get("client_secret")).toBe("fake-client-secret");
    expect(await listRows(test.database)).toEqual(["fake/default connected oauth test"]);

    const token = await getAccessToken(test.ctx, { provider: "fake" });
    if (!token.ok) throw new Error(`test: ${token.error}`);
    expect(test.fake.isAccessTokenValid(token.value.accessToken)).toBe(true);
    const raw = JSON.stringify(await readRawRow(test.database, "fake"));
    expect(raw).not.toContain(token.value.accessToken);
    expect(raw).not.toContain("rt-");
    expect(await readRawRow(test.database, "fake")).toMatchObject({
      scopes: ["read", "write"],
      has_refresh_token: true,
      expires_at: new Date(NOW.getTime() + 3600_000),
      connected_by: ADMIN,
      token_type: "Bearer",
    });
    // The state is spent.
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).toEqual({ ok: false, error: "connections.state_invalid" });
  });

  it("refuses a callback from another admin's session without spending the state", async () => {
    const callback = test.fake.consent((await start()).toString());
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: OTHER_ADMIN })).toEqual({ ok: false, error: "connections.state_invalid" });
    expect((await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).ok).toBe(true);
  });

  it("refuses an expired state, an unknown one and none", async () => {
    const callback = test.fake.consent((await start()).toString());
    test.clock.advance(10 * 60_000);
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).toEqual({ ok: false, error: "connections.state_invalid" });
    expect(await completeAuthorization(test.ctx, { params: { state: "nope", code: "x", error: null }, actorId: ADMIN })).toEqual({ ok: false, error: "connections.state_invalid" });
    expect(await completeAuthorization(test.ctx, { params: { state: null, code: "x", error: null }, actorId: ADMIN })).toEqual({ ok: false, error: "connections.state_invalid" });
  });

  it("removes expired authorizations when a new one starts", async () => {
    await start();
    test.clock.advance(11 * 60_000);
    await start();
    const count = await test.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM connections.oauth_states");
    expect(count.rows[0]?.count).toBe(1);
  });

  it("answers a denied consent and another provider error as codes, spending the state", async () => {
    const denied = test.fake.consent((await start()).toString(), { deny: true });
    expect(await completeAuthorization(test.ctx, { params: toParams(denied), actorId: ADMIN })).toEqual({ ok: false, error: "connections.consent_denied" });
    const url = await start();
    const failed = { state: url.searchParams.get("state"), code: null, error: "server_error" };
    expect(await completeAuthorization(test.ctx, { params: failed, actorId: ADMIN })).toEqual({ ok: false, error: "connections.authorization_failed" });
    const noCode = await start();
    expect(await completeAuthorization(test.ctx, { params: { state: noCode.searchParams.get("state"), code: null, error: null }, actorId: ADMIN })).toEqual({
      ok: false,
      error: "connections.authorization_failed",
    });
    expect(await listRows(test.database)).toEqual([]);
  });

  it("refuses a code with the wrong verifier at the provider (PKCE)", async () => {
    const url = await start();
    const callback = test.fake.consent(url.toString());
    await test.database.client.query("UPDATE connections.oauth_states SET verifier = NULL");
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).toEqual({ ok: false, error: "connections.exchange_failed" });
  });

  it.each([
    ["an outage", "unavailable", "connections.exchange_failed"],
    ["a network failure", "unreachable", "connections.exchange_failed"],
    ["an error answered with 200", "error_with_200", "connections.exchange_failed"],
    ["a refused client", "invalid_client", "connections.client_rejected"],
    ["a redirect", "redirect", "connections.exchange_failed"],
  ] as const)("answers %s at the exchange as %s", async (_case, failure, code) => {
    const callback = test.fake.consent((await start()).toString());
    test.fake.failNext(failure);
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).toEqual({ ok: false, error: code });
    expect(await listRows(test.database)).toEqual([]);
  });

  it("stores the scopes the provider granted, not the requested ones", async () => {
    await test.database.close();
    test = await createTestConnections({ fake: { grantedScopes: ["read"] } });
    const callback = test.fake.consent((await start()).toString());
    await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN });
    expect((await listConnections(test.ctx))[0]?.scopes).toEqual(["read"]);
  });

  it("replaces a connection on reconnect, back to connected", async () => {
    for (let round = 0; round < 2; round += 1) {
      const callback = test.fake.consent((await start()).toString());
      expect((await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).ok).toBe(true);
    }
    await test.database.client.query("UPDATE connections.accounts SET status = 'reconnect_required'");
    const callback = test.fake.consent((await start()).toString());
    await completeAuthorization(test.ctx, { params: toParams(callback), actorId: OTHER_ADMIN }).then((result) => expect(result.ok).toBe(false));
    const own = test.fake.consent((await start()).toString());
    expect((await completeAuthorization(test.ctx, { params: toParams(own), actorId: ADMIN })).ok).toBe(true);
    expect(await listRows(test.database)).toEqual(["fake/default connected oauth test"]);
  });

  it("refuses to start for an unknown provider or account, a key provider, a missing secret or keyring", async () => {
    expect(await startAuthorization(test.ctx, { provider: "nope", actorId: ADMIN })).toEqual({ ok: false, error: "connections.unknown_provider" });
    expect(await startAuthorization(test.ctx, { provider: "fake", accountId: "work", actorId: ADMIN })).toEqual({ ok: false, error: "connections.unknown_provider" });
    expect(await startAuthorization(test.ctx, { provider: "raindrop", actorId: ADMIN })).toEqual({ ok: false, error: "connections.wrong_kind" });
    expect(await startAuthorization({ ...test.ctx, env: { SOFTURE_CONNECTIONS_KEYS: test.ctx.env?.SOFTURE_CONNECTIONS_KEYS } }, { provider: "fake", actorId: ADMIN })).toEqual({
      ok: false,
      error: "connections.provider_not_configured",
    });
    expect(await startAuthorization({ ...test.ctx, env: test.fake.env }, { provider: "fake", actorId: ADMIN })).toEqual({ ok: false, error: "connections.key_missing" });
  });

  it("sends the client with HTTP Basic when the provider asks for it", async () => {
    await test.database.close();
    test = await createTestConnections({ fake: { clientAuth: "basic" } });
    const callback = test.fake.consent((await start()).toString());
    expect((await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).ok).toBe(true);
    expect(test.fake.calls.lastForm?.has("client_secret")).toBe(false);
    expect(test.fake.calls.lastAuthorization).toBe(`Basic ${Buffer.from("fake-client:fake-client-secret").toString("base64")}`);
  });
});
