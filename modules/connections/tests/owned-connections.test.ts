// Connections a signed-in user owns (`owner: "user"`): one provider, a connection per user, each sealed to its owner,
// reachable only with that owner's id, never listed on the admin panel, and part of the owner's privacy data.
import { connections, type ProviderDefinitionInput } from "@softure-ai/connections";
import {
  completeAuthorization,
  disconnect,
  exportConnectionsUserData,
  deleteConnectionsUserData,
  getAccessToken,
  getCredential,
  listConnections,
  listOwnConnections,
  requestWithConnection,
  saveCredential,
  startAuthorization,
  type CallbackParams,
} from "@softure-ai/connections/server";
import type { FakeConsentOptions, FakeOAuthProvider } from "@softure-ai/connections/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADMIN, createOwnedProvider, createTestConnections, KEY_PROVIDERS, NOW, type TestConnections } from "./support.js";

const ADA = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99";
const BOB = "5e4d3c2b-1a09-4f8e-8d7c-6b5a4e3d2c1b";

function ownedProviders(fake: FakeOAuthProvider): ProviderDefinitionInput[] {
  return [
    createOwnedProvider(fake, { id: "drive", subjectField: "account_id" }),
    ...KEY_PROVIDERS,
  ];
}

function toParams(url: URL): CallbackParams {
  return { state: url.searchParams.get("state"), code: url.searchParams.get("code"), error: url.searchParams.get("error") };
}

describe("connections a user owns", () => {
  let test: TestConnections;

  beforeEach(async () => {
    test = await createTestConnections({ providers: ownedProviders, connections: { keysEnv: "APP_SOURCE_KEYS" } });
    // The keyring under the app's own variable name, as `keysEnv` names it.
    const env: Record<string, string | undefined> = { ...test.ctx.env };
    env.APP_SOURCE_KEYS = env.SOFTURE_CONNECTIONS_KEYS;
    delete env.SOFTURE_CONNECTIONS_KEYS;
    test = { ...test, ctx: { ...test.ctx, env } };
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function consent(actorId: string, options: FakeConsentOptions = {}): Promise<URL> {
    const started = await startAuthorization(test.ctx, { provider: "drive", actorId });
    if (!started.ok) throw new Error(`test: start failed with ${started.error}`);
    return test.fake.consent(started.value.url, options);
  }

  async function connect(actorId: string, accountId: string): Promise<void> {
    const callback = await consent(actorId, { tokenFields: { account_id: accountId } });
    const completed = await completeAuthorization(test.ctx, { params: toParams(callback), actorId });
    expect(completed).toEqual({ ok: true, value: { provider: "drive", accountId: "default", ownerId: actorId } });
  }

  async function readOwners(): Promise<string[]> {
    const result = await test.database.client.query<{ owner_id: string | null; subject: string | null; provider: string }>(
      "SELECT owner_id, subject, provider FROM connections.accounts ORDER BY owner_id",
    );
    return result.rows.map((row) => `${row.provider} ${row.owner_id ?? "app"} ${row.subject ?? "-"}`);
  }

  it("keeps one connection per user for the same provider account, each with the provider's account id", async () => {
    await connect(ADA, "dbid:ada");
    await connect(BOB, "dbid:bob");
    await connect(ADA, "dbid:ada");
    expect(await readOwners()).toEqual([`drive ${ADA} dbid:ada`, `drive ${BOB} dbid:bob`]);
    const [view] = await listOwnConnections(test.ctx, ADA);
    expect(view).toMatchObject({ provider: "drive", accountId: "default", ownerId: ADA, subject: "dbid:ada", status: "connected", connectedBy: ADA, connectedAt: NOW });
    expect((await listOwnConnections(test.ctx, "nobody")).map((entry) => entry.status)).toEqual(["not_connected"]);
  });

  it("answers each owner's token only to that owner, and nothing to a call without an owner", async () => {
    await connect(ADA, "dbid:ada");
    await connect(BOB, "dbid:bob");
    const ada = await getAccessToken(test.ctx, { provider: "drive", ownerId: ADA });
    const bob = await getAccessToken(test.ctx, { provider: "drive", ownerId: BOB });
    expect(ada.ok && bob.ok && ada.value !== bob.value).toBe(true);
    expect(await getAccessToken(test.ctx, { provider: "drive" })).toEqual({ ok: false, error: "connections.wrong_owner" });
    expect(await getAccessToken(test.ctx, { provider: "drive", ownerId: "nobody" })).toEqual({ ok: false, error: "connections.not_connected" });
    expect(await requestWithConnection(test.ctx, { provider: "drive", ownerId: ADA }, { url: test.fake.apiUrl, fetch: test.fake.fetch })).toEqual({ ok: true, value: { ok: true } });
  });

  it("refuses an owner on the app's own providers", async () => {
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "k" }, actorId: ADMIN });
    expect(await getCredential(test.ctx, { provider: "raindrop", ownerId: ADA })).toEqual({ ok: false, error: "connections.wrong_owner" });
    expect(await saveCredential(test.ctx, { provider: "raindrop", ownerId: ADA, credential: { kind: "api_key", apiKey: "k" }, actorId: ADA })).toEqual({
      ok: false,
      error: "connections.wrong_owner",
    });
    expect(await getCredential(test.ctx, { provider: "raindrop" })).toEqual({ ok: true, value: { kind: "api_key", apiKey: "k" } });
  });

  it("seals each grant to its owner, so a row moved to another owner does not open", async () => {
    await connect(ADA, "dbid:ada");
    await test.database.client.query("UPDATE connections.accounts SET owner_id = $1", [BOB]);
    const moved = await getAccessToken(test.ctx, { provider: "drive", ownerId: BOB });
    expect(moved.ok).toBe(false);
  });

  it("lets only the user who started it complete an authorization, and never through the app's own completion", async () => {
    const callback = await consent(ADA);
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: BOB })).toEqual({ ok: false, error: "connections.state_invalid" });
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADA, ownOnly: true })).toEqual({
      ok: true,
      value: { provider: "drive", accountId: "default", ownerId: ADA },
    });
  });

  it("keeps an admin's authorization of an app provider out of a user's own completion", async () => {
    await test.database.close();
    test = await createTestConnections({ providers: (fake) => [fake.definition, ...ownedProviders(fake)] });
    const started = await startAuthorization(test.ctx, { provider: "fake", actorId: ADMIN });
    if (!started.ok) throw new Error(`test: start failed with ${started.error}`);
    const callback = test.fake.consent(started.value.url);
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN, ownOnly: true })).toEqual({ ok: false, error: "connections.state_invalid" });
    expect((await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADMIN })).ok).toBe(true);
  });

  it("names the owner in a failed connect, so the app sends the user back to their own page", async () => {
    const callback = await consent(ADA, { deny: true });
    expect(await completeAuthorization(test.ctx, { params: toParams(callback), actorId: ADA, ownOnly: true })).toEqual({
      ok: false,
      error: "connections.consent_denied",
      target: { provider: "drive", accountId: "default", ownerId: ADA },
    });
  });

  it("leaves owned connections off the admin panel", async () => {
    await connect(ADA, "dbid:ada");
    expect((await listConnections(test.ctx)).map((view) => view.provider)).toEqual(["raindrop", "toggl", "toggl"]);
  });

  it("disconnects one owner's connection only", async () => {
    await connect(ADA, "dbid:ada");
    await connect(BOB, "dbid:bob");
    expect(await disconnect(test.ctx, { provider: "drive", ownerId: ADA, actorId: ADA })).toEqual({ ok: true, value: { revoked: true } });
    expect(await disconnect(test.ctx, { provider: "drive", ownerId: ADA, actorId: ADA })).toEqual({ ok: false, error: "connections.not_connected" });
    expect(await disconnect(test.ctx, { provider: "drive", actorId: ADMIN })).toEqual({ ok: false, error: "connections.wrong_owner" });
    expect(await readOwners()).toEqual([`drive ${BOB} dbid:bob`]);
  });

  it("exports an owner's connections without a secret and deletes them with the account", async () => {
    await connect(ADA, "dbid:ada");
    await connect(BOB, "dbid:bob");
    expect(await exportConnectionsUserData({ db: test.database.db }, ADA)).toEqual({
      ok: true,
      value: {
        // `connectedAccounts` lists app connections the user made; their own ones are under `ownConnections`.
        connectedAccounts: [],
        pendingAuthorizations: [],
        ownConnections: [{ provider: "drive", accountId: "default", subject: "dbid:ada", scopes: ["read", "write"], status: "connected", connectedAt: NOW }],
      },
    });
    expect(await deleteConnectionsUserData({ db: test.database.db }, ADA)).toEqual({ ok: true, value: { clearedConnections: 0, deletedAuthorizations: 0, deletedConnections: 1 } });
    expect(await readOwners()).toEqual([`drive ${BOB} dbid:bob`]);
  });

  it("keeps no subject the provider answers out of shape", async () => {
    await connect(ADA, "a".repeat(201));
    await connect(BOB, "line\nbreak");
    expect(await readOwners()).toEqual([`drive ${ADA} -`, `drive ${BOB} -`]);
  });

  it("refuses a user-owned provider without the page to return to", () => {
    const provider = { ...ownedProviders(test.fake)[0], returnPath: undefined } as ProviderDefinitionInput;
    expect(() => connections({ providers: [provider] })).toThrow(/returnPath/);
    expect(() => connections({ providers: [{ ...provider, returnPath: "https://elsewhere.test/" } as ProviderDefinitionInput] })).toThrow();
  });
});
