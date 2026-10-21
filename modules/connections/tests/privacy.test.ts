// The privacy contributor: the connections an admin made and their pending authorizations; deleting the admin
// keeps the app's connections and clears the admin's id.
import { connections } from "@softure-ai/connections";
import { connectionsPrivacyContributor, deleteConnectionsUserData, exportConnectionsUserData, saveCredential, startAuthorization } from "@softure-ai/connections/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectFake } from "./connect.js";
import { ADMIN, createTestConnections, listRows, NOW, OTHER_ADMIN, readRawRow, type TestConnections } from "./support.js";

describe("the connections privacy contributor", () => {
  let test: TestConnections;

  beforeEach(async () => {
    test = await createTestConnections();
    await connectFake(test);
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "k" }, actorId: OTHER_ADMIN });
    await startAuthorization(test.ctx, { provider: "fake", actorId: ADMIN });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("is registered with the module, as its manifest promises", () => {
    expect(connections.manifest.privacy).toEqual({ exports: true, deletes: true });
    expect(connections().privacy?.exportUserData).toBe(exportConnectionsUserData);
  });

  it("exports what the user connected and started, never a secret", async () => {
    const exported = await exportConnectionsUserData({ db: test.database.db }, ADMIN);
    expect(exported).toEqual({
      ok: true,
      value: {
        connectedAccounts: [{ provider: "fake", accountId: "default", connectedAt: NOW }],
        pendingAuthorizations: [{ provider: "fake", accountId: "default", createdAt: NOW }],
      },
    });
    expect(await exportConnectionsUserData({ db: test.database.db }, "someone-else")).toEqual({ ok: true, value: { connectedAccounts: [], pendingAuthorizations: [] } });
  });

  it("clears the user from connections, keeps them, and deletes the user's pending authorizations", async () => {
    expect(await deleteConnectionsUserData({ db: test.database.db }, ADMIN)).toEqual({ ok: true, value: { clearedConnections: 1, deletedAuthorizations: 1 } });
    expect(await listRows(test.database)).toEqual(["fake/default connected oauth test", "raindrop/default connected api_key test"]);
    expect(await readRawRow(test.database, "fake")).toMatchObject({ connected_by: null });
    expect(await readRawRow(test.database, "raindrop")).toMatchObject({ connected_by: OTHER_ADMIN });
  });

  it("answers privacy's deletion with an empty ok", async () => {
    expect(await connectionsPrivacyContributor.deleteUserData?.(test.ctx, OTHER_ADMIN)).toEqual({ ok: true, value: undefined });
    expect(await readRawRow(test.database, "raindrop")).toMatchObject({ connected_by: null });
  });
});
