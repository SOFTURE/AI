// listConnections: every declared provider account, in order, with its health and no secret.
import { listConnections, saveCredential } from "@softure-ai/connections/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectFake } from "./connect.js";
import { ADMIN, createTestConnections, NOW, type TestConnections } from "./support.js";

describe("listConnections", () => {
  let test: TestConnections;

  beforeEach(async () => {
    test = await createTestConnections({ fake: { issuesRefreshToken: false, accessTokenTtlSeconds: 100 * 3600 } });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("lists every provider account in declared order, not connected at first", async () => {
    const views = await listConnections(test.ctx);
    expect(views.map((view) => `${view.provider}/${view.accountId} ${view.kind} ${view.label} ${view.status}`)).toEqual([
      "fake/default oauth Fake provider not_connected",
      "raindrop/default api_key Raindrop not_connected",
      "toggl/work basic Toggl not_connected",
      "toggl/personal basic Toggl not_connected",
    ]);
  });

  it("shows a grant without a refresh token as expiring near its access token's end, then needing a reconnect", async () => {
    await connectFake(test);
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "k" }, actorId: ADMIN });
    const [fake, raindrop] = await listConnections(test.ctx);
    expect(fake).toEqual({
      provider: "fake",
      accountId: "default",
      kind: "oauth",
      label: "Fake provider",
      status: "connected",
      scopes: ["read", "write"],
      expiresAt: new Date(NOW.getTime() + 100 * 3600_000),
      refreshExpiresAt: null,
      connectedAt: NOW,
      connectedBy: ADMIN,
      refreshedAt: null,
      lastError: null,
      lastErrorAt: null,
    });
    expect(raindrop?.status).toBe("connected");
    test.clock.advance(28 * 3600_000 + 1);
    expect((await listConnections(test.ctx))[0]?.status).toBe("expiring");
    test.clock.advance(72 * 3600_000);
    expect((await listConnections(test.ctx))[0]?.status).toBe("reconnect_required");
  });

  it("answers nothing when the app declares no providers", async () => {
    await test.database.close();
    test = await createTestConnections({ providers: () => [] });
    expect(await listConnections(test.ctx)).toEqual([]);
  });
});
