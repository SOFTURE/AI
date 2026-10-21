// API key and Basic credentials, the app's report of a refused credential, and disconnecting.
import type { ReconnectRequiredEvent } from "@softure-ai/connections";
import { disconnect, getAuthorizationHeader, getCredential, listConnections, reportCredentialRejected, saveCredential } from "@softure-ai/connections/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectFake } from "./connect.js";
import { ADMIN, createTestConnections, listRows, readRawRow, type TestConnections } from "./support.js";

describe("key credentials", () => {
  let test: TestConnections;
  let events: ReconnectRequiredEvent[];

  beforeEach(async () => {
    events = [];
    test = await createTestConnections({ connections: { onReconnectRequired: (event) => void events.push(event) } });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("stores an API key sealed and answers it", async () => {
    expect(await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "  rd-secret-key \n" }, actorId: ADMIN })).toEqual({ ok: true, value: undefined });
    expect(await getCredential(test.ctx, { provider: "raindrop" })).toEqual({ ok: true, value: { kind: "api_key", apiKey: "rd-secret-key" } });
    expect(JSON.stringify(await readRawRow(test.database, "raindrop"))).not.toContain("rd-secret-key");
    expect(await listRows(test.database)).toEqual(["raindrop/default connected api_key test"]);
  });

  it("stores a Basic credential per account and answers it", async () => {
    await saveCredential(test.ctx, { provider: "toggl", accountId: "work", credential: { kind: "basic", username: "ada", password: "pw:with:colons" }, actorId: ADMIN });
    expect(await getCredential(test.ctx, { provider: "toggl", accountId: "work" })).toEqual({ ok: true, value: { kind: "basic", username: "ada", password: "pw:with:colons" } });
    expect(await getCredential(test.ctx, { provider: "toggl", accountId: "personal" })).toEqual({ ok: false, error: "connections.not_connected" });
    expect(await getCredential(test.ctx, { provider: "toggl" })).toEqual({ ok: false, error: "connections.unknown_provider" });
  });

  it.each([
    ["an empty key", "raindrop", { kind: "api_key", apiKey: "   " }, "connections.credential_invalid"],
    ["a key over the limit", "raindrop", { kind: "api_key", apiKey: "k".repeat(4097) }, "connections.credential_invalid"],
    ["a username with a colon", "toggl", { kind: "basic", username: "a:b", password: "x" }, "connections.credential_invalid"],
    ["an empty password", "toggl", { kind: "basic", username: "a", password: "" }, "connections.credential_invalid"],
    ["Basic for an API key provider", "raindrop", { kind: "basic", username: "a", password: "b" }, "connections.wrong_kind"],
    ["a key for an OAuth provider", "fake", { kind: "api_key", apiKey: "x" }, "connections.wrong_kind"],
  ] as const)("refuses %s", async (_case, provider, credential, code) => {
    const accountId = provider === "toggl" ? "work" : undefined;
    expect(await saveCredential(test.ctx, { provider, ...(accountId === undefined ? {} : { accountId }), credential, actorId: ADMIN })).toEqual({ ok: false, error: code });
    expect(await listRows(test.database)).toEqual([]);
  });

  it("marks a credential the provider refused, runs the hook once, and a new key restores it", async () => {
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "old" }, actorId: ADMIN });
    expect(await reportCredentialRejected(test.ctx, { provider: "raindrop" })).toEqual({ ok: true, value: true });
    expect(await reportCredentialRejected(test.ctx, { provider: "raindrop" })).toEqual({ ok: true, value: false });
    expect(events).toEqual([{ provider: "raindrop", accountId: "default", kind: "api_key", reason: "rejected", at: test.clock.now() }]);
    expect(await getCredential(test.ctx, { provider: "raindrop" })).toEqual({ ok: false, error: "connections.reconnect_required" });
    expect((await listConnections(test.ctx)).find((view) => view.provider === "raindrop")?.status).toBe("reconnect_required");
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "new" }, actorId: ADMIN });
    expect(await getCredential(test.ctx, { provider: "raindrop" })).toEqual({ ok: true, value: { kind: "api_key", apiKey: "new" } });
    expect(await reportCredentialRejected(test.ctx, { provider: "raindrop", accountId: "other" })).toEqual({ ok: false, error: "connections.unknown_provider" });
    expect(await reportCredentialRejected(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.not_connected" });
  });

  it("builds the Authorization header for each kind", () => {
    expect(getAuthorizationHeader({ kind: "api_key", apiKey: "k" })).toBe("Bearer k");
    expect(getAuthorizationHeader({ kind: "oauth", accessToken: "t" })).toBe("Bearer t");
    expect(getAuthorizationHeader({ kind: "basic", username: "ada", password: "pä" })).toBe(`Basic ${Buffer.from("ada:pä", "utf8").toString("base64")}`);
  });
});

describe("disconnect", () => {
  let test: TestConnections;

  beforeEach(async () => {
    test = await createTestConnections();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("deletes an OAuth connection and revokes its refresh token at the provider", async () => {
    await connectFake(test);
    expect(await disconnect(test.ctx, { provider: "fake" })).toEqual({ ok: true, value: { revoked: true } });
    expect(test.fake.calls.revoke).toBe(1);
    expect(test.fake.calls.lastForm?.get("token_type_hint")).toBe("refresh_token");
    expect(await listRows(test.database)).toEqual([]);
    expect(await disconnect(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.not_connected" });
  });

  it("deletes the connection even when the revocation fails", async () => {
    await connectFake(test);
    test.fake.failNext("unavailable");
    expect(await disconnect(test.ctx, { provider: "fake" })).toEqual({ ok: true, value: { revoked: false } });
    expect(await listRows(test.database)).toEqual([]);
  });

  it("deletes a key credential without calling anyone", async () => {
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "k" }, actorId: null });
    expect(await disconnect(test.ctx, { provider: "raindrop" })).toEqual({ ok: true, value: { revoked: false } });
    expect(test.fake.calls.revoke).toBe(0);
    expect(await disconnect(test.ctx, { provider: "nope" })).toEqual({ ok: false, error: "connections.unknown_provider" });
  });
});
