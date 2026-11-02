// Issue #945: every connect, reconnect, disconnect and failed OAuth callback runs `onConnectionChanged` after the
// change is stored and writes one info line, with ids and codes only.
import type { ConnectionChangedEvent } from "@softure-ai/connections";
import { completeAuthorization, disconnect, reportCredentialRejected, saveCredential, startAuthorization, type CallbackParams } from "@softure-ai/connections/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectFake } from "./connect.js";
import { ADMIN, createTestConnections, listRows, NOW, OTHER_ADMIN, type TestConnections } from "./support.js";

function toParams(url: URL): CallbackParams {
  return { state: url.searchParams.get("state"), code: url.searchParams.get("code"), error: url.searchParams.get("error") };
}

describe("onConnectionChanged and the change log line", () => {
  let test: TestConnections;
  let events: { event: ConnectionChangedEvent; rows: string[] }[];
  let lines: string[];

  beforeEach(async () => {
    events = [];
    lines = [];
    vi.spyOn(console, "info").mockImplementation((line: string) => void lines.push(line));
    test = await createTestConnections({
      connections: {
        // The rows at the time of the hook prove it runs after the change is stored.
        onConnectionChanged: async (event) => void events.push({ event, rows: await listRows(test.database) }),
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await test.database.close();
  });

  async function start(actorId = ADMIN): Promise<URL> {
    const started = await startAuthorization(test.ctx, { provider: "fake", actorId });
    if (!started.ok) throw new Error(`test: start failed with ${started.error}`);
    return new URL(started.value.url);
  }

  it("reports an OAuth connect, then a reconnect of the same account", async () => {
    await connectFake(test);
    await connectFake(test);
    expect(events).toEqual([
      { event: { change: "connected", provider: "fake", accountId: "default", kind: "oauth", actorId: ADMIN, at: NOW }, rows: ["fake/default connected oauth test"] },
      { event: { change: "reconnected", provider: "fake", accountId: "default", kind: "oauth", actorId: ADMIN, at: NOW }, rows: ["fake/default connected oauth test"] },
    ]);
    expect(lines).toEqual([
      `@softure-ai/connections: connection connected provider=fake account_id=default kind=oauth actor_id=${ADMIN}`,
      `@softure-ai/connections: connection reconnected provider=fake account_id=default kind=oauth actor_id=${ADMIN}`,
    ]);
  });

  it("reports a saved key as connected, and a new key for a reconnect_required one as reconnected", async () => {
    await saveCredential(test.ctx, { provider: "toggl", accountId: "work", credential: { kind: "basic", username: "ada", password: "pw-secret" }, actorId: ADMIN });
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-secret" }, actorId: null });
    await reportCredentialRejected(test.ctx, { provider: "raindrop" });
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-secret-2" }, actorId: OTHER_ADMIN });
    expect(events.map((entry) => entry.event)).toEqual([
      { change: "connected", provider: "toggl", accountId: "work", kind: "basic", actorId: ADMIN, at: NOW },
      { change: "connected", provider: "raindrop", accountId: "default", kind: "api_key", actorId: null, at: NOW },
      { change: "reconnected", provider: "raindrop", accountId: "default", kind: "api_key", actorId: OTHER_ADMIN, at: NOW },
    ]);
    expect(events[0]?.rows).toEqual(["toggl/work connected basic test"]);
    expect(events[2]?.rows).toEqual(["raindrop/default connected api_key test", "toggl/work connected basic test"]);
    expect(lines).toEqual([
      `@softure-ai/connections: connection connected provider=toggl account_id=work kind=basic actor_id=${ADMIN}`,
      "@softure-ai/connections: connection connected provider=raindrop account_id=default kind=api_key actor_id=null",
      `@softure-ai/connections: connection reconnected provider=raindrop account_id=default kind=api_key actor_id=${OTHER_ADMIN}`,
    ]);
  });

  it("reports nothing for a key the form refuses", async () => {
    expect(await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: " " }, actorId: ADMIN })).toEqual({ ok: false, error: "connections.credential_invalid" });
    expect(await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "basic", username: "a", password: "b" }, actorId: ADMIN })).toEqual({ ok: false, error: "connections.wrong_kind" });
    expect(events).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("reports a disconnect after the row is gone, with the actor and whether the grant was revoked", async () => {
    await connectFake(test);
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-secret" }, actorId: ADMIN });
    events = [];
    lines = [];
    expect(await disconnect(test.ctx, { provider: "fake", actorId: OTHER_ADMIN })).toEqual({ ok: true, value: { revoked: true } });
    expect(await disconnect(test.ctx, { provider: "raindrop" })).toEqual({ ok: true, value: { revoked: false } });
    expect(await disconnect(test.ctx, { provider: "raindrop" })).toEqual({ ok: false, error: "connections.not_connected" });
    expect(events).toEqual([
      { event: { change: "disconnected", provider: "fake", accountId: "default", kind: "oauth", actorId: OTHER_ADMIN, revoked: true, at: NOW }, rows: ["raindrop/default connected api_key test"] },
      { event: { change: "disconnected", provider: "raindrop", accountId: "default", kind: "api_key", actorId: null, revoked: false, at: NOW }, rows: [] },
    ]);
    expect(lines).toEqual([
      `@softure-ai/connections: connection disconnected provider=fake account_id=default kind=oauth actor_id=${OTHER_ADMIN} revoked=true`,
      "@softure-ai/connections: connection disconnected provider=raindrop account_id=default kind=api_key actor_id=null revoked=false",
    ]);
  });

  it.each([
    ["a denied consent", "deny", "connections.consent_denied"],
    ["an outage at the token endpoint", "unavailable", "connections.exchange_failed"],
    ["a refused client", "invalid_client", "connections.client_rejected"],
  ] as const)("reports %s as connect_failed with the provider of the pending authorization", async (_name, failure, code) => {
    const authorizeUrl = await start();
    if (failure !== "deny") test.fake.failNext(failure);
    const callback = test.fake.consent(authorizeUrl.toString(), { deny: failure === "deny" });
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).toEqual({ ok: false, error: code });
    expect(events).toEqual([{ event: { change: "connect_failed", provider: "fake", accountId: "default", kind: "oauth", actorId: ADMIN, code, at: NOW }, rows: [] }]);
    expect(lines).toEqual([`@softure-ai/connections: connection connect_failed provider=fake account_id=default kind=oauth actor_id=${ADMIN} code=${code}`]);
  });

  it("reports nothing for a callback whose authorization is unknown, so its provider is too", async () => {
    const callback = test.fake.consent((await start()).toString());
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: OTHER_ADMIN })).toEqual({ ok: false, error: "connections.state_invalid" });
    expect(await completeAuthorization(test.ctx, { params: { state: null, code: "c", error: null }, actorId: ADMIN })).toEqual({ ok: false, error: "connections.state_invalid" });
    expect(events).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("never puts a credential, a code or a state in the event or the line", async () => {
    const authorizeUrl = await start();
    const callback = test.fake.consent(authorizeUrl.toString());
    await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN });
    await saveCredential(test.ctx, { provider: "toggl", accountId: "work", credential: { kind: "basic", username: "ada", password: "pw-secret" }, actorId: ADMIN });
    await disconnect(test.ctx, { provider: "fake", actorId: ADMIN });
    const text = JSON.stringify([events, lines]);
    for (const secret of [callback.searchParams.get("code"), callback.searchParams.get("state"), "pw-secret", "ada", test.fake.env.FAKE_OAUTH_CLIENT_SECRET]) {
      expect(secret).toBeTruthy();
      expect(text).not.toContain(secret);
    }
  });

  it("quotes an actor id that is not a plain token, so it cannot forge a field", async () => {
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "k" }, actorId: "ops script provider=other" });
    expect(lines).toEqual(['@softure-ai/connections: connection connected provider=raindrop account_id=default kind=api_key actor_id="ops script provider=other"']);
  });

  it("logs a throwing hook by kind and still stores and answers the change", async () => {
    await test.database.close();
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: string) => void errors.push(line));
    test = await createTestConnections({
      connections: {
        onConnectionChanged: () => {
          throw new TypeError("audit store down");
        },
      },
    });
    expect(await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "k" }, actorId: ADMIN })).toEqual({ ok: true, value: undefined });
    expect(await listRows(test.database)).toEqual(["raindrop/default connected api_key test"]);
    expect(errors).toEqual(["@softure-ai/connections: the onConnectionChanged hook failed: TypeError"]);
    expect(lines).toEqual([`@softure-ai/connections: connection connected provider=raindrop account_id=default kind=api_key actor_id=${ADMIN}`]);
  });
});
