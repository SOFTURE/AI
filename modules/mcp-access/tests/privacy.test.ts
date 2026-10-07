// The mcp-access contributor to GDPR exports and deletions: the user's tokens without their hashes.
import { mcpAccess } from "@softure-ai/mcp-access";
import { deleteMcpAccessUserData, exportMcpAccessUserData, issueAccessToken } from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectApp, createConfig, createTestMcp, createUser, NOW, OAUTH_OPTIONS, OPTIONS, type TestMcp } from "./support.js";

describe("the mcp-access privacy contributor", () => {
  let test: TestMcp;
  let ada: string;
  let bob: string;

  beforeEach(async () => {
    test = await createTestMcp();
    ada = await createUser(test.database, "ada@example.com");
    bob = await createUser(test.database, "bob@example.com");
    for (const userId of [ada, bob]) {
      const issued = await issueAccessToken(test.ctx, { userId, name: "Laptop", canWrite: true });
      if (!issued.ok) throw new Error(issued.error);
    }
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("is registered with the module, as its manifest promises", () => {
    expect(mcpAccess.manifest.privacy).toEqual({ exports: true, deletes: true });
    expect(mcpAccess(OPTIONS).privacy?.deleteUserData).toBe(deleteMcpAccessUserData);
  });

  it("exports the user's tokens by name and dates, without any hash", async () => {
    const result = await exportMcpAccessUserData(test.ctx, ada);
    expect(result).toEqual({
      ok: true,
      value: { accessTokens: [{ name: "Laptop", canWrite: true, createdAt: NOW, expiresAt: expect.any(Date) as Date, lastUsedAt: null }], connectedApps: [] },
    });
    expect(JSON.stringify(result)).not.toMatch(/[0-9a-f]{64}/);
    expect(await exportMcpAccessUserData(test.ctx, "not-a-uuid")).toEqual({ ok: true, value: { accessTokens: [], connectedApps: [] } });
  });

  it("deletes the user's tokens and nobody else's", async () => {
    expect(await deleteMcpAccessUserData(test.ctx, ada)).toEqual({ ok: true, value: undefined });
    const rows = await test.database.client.query<{ user_id: string }>("SELECT user_id FROM mcp.access_tokens");
    expect(rows.rows).toEqual([{ user_id: bob }]);
  });

  describe("with apps connected through OAuth", () => {
    beforeEach(async () => {
      await test.database.close();
      test = await createTestMcp(createConfig(OAUTH_OPTIONS));
      ada = await createUser(test.database, "ada@example.com");
      bob = await createUser(test.database, "bob@example.com");
      await connectApp(test.ctx, ada, { clientName: "Assistant", canWrite: true });
      await connectApp(test.ctx, bob, { clientName: "Other" });
    });

    it("exports the connected apps, not their short-lived tokens, without any hash", async () => {
      const result = await exportMcpAccessUserData(test.ctx, ada);
      expect(result).toEqual({ ok: true, value: { accessTokens: [], connectedApps: [{ clientName: "Assistant", canWrite: true, createdAt: NOW, lastUsedAt: null }] } });
      expect(JSON.stringify(result)).not.toMatch(/[0-9a-f]{64}/);
    });

    it("deletes the user's grants, codes and their tokens, and nobody else's", async () => {
      await deleteMcpAccessUserData(test.ctx, ada);
      const grants = await test.database.client.query<{ user_id: string }>("SELECT user_id FROM mcp.oauth_grants");
      const codes = await test.database.client.query<{ user_id: string }>("SELECT user_id FROM mcp.oauth_authorization_codes");
      const tokens = await test.database.client.query<{ user_id: string }>("SELECT user_id FROM mcp.access_tokens");
      expect([grants.rows, codes.rows, tokens.rows]).toEqual([[{ user_id: bob }], [{ user_id: bob }], [{ user_id: bob }]]);
    });
  });
});
