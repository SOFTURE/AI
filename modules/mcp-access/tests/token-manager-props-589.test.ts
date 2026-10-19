// Issue #589: an app that composes its own token page around `TokenManager` gets the same props
// `McpAccessPage` renders, from `getTokenManagerProps`, instead of copying the builders. Next's request
// scope is stubbed: the config and `getConfiguredDatabase`, which hands the module the PGlite test database.
import type { SoftureConfig } from "@softure-ai/core";
import type { Database } from "@softure-ai/db";
import { mcpAccessMessages } from "@softure-ai/mcp-access";
import { getTokenManagerProps } from "@softure-ai/mcp-access/next";
import { issueAccessToken } from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectApp, createConfig, createTestMcp, createUser, NOW, OAUTH_OPTIONS, type TestMcp } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  db: Database | undefined;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, db: undefined }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("@softure-ai/auth/next", () => ({ getCurrentUser: () => Promise.resolve(null) }));
vi.mock("@softure-ai/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@softure-ai/db")>()),
  getConfiguredDatabase: () => {
    if (scope.db === undefined) throw new Error("test: no database registered");
    return Promise.resolve({ db: scope.db });
  },
}));

describe("getTokenManagerProps", () => {
  let test: TestMcp;
  let alice: string;

  async function setUp(config?: SoftureConfig): Promise<void> {
    test = await createTestMcp(config);
    alice = await createUser(test.database, "alice@example.com");
    scope.config = test.config;
    scope.db = test.database.db;
  }

  afterEach(async () => {
    await test.database.close();
  });

  describe("with OAuth off", () => {
    beforeEach(() => setUp());

    it("returns the tools, the user's tokens and the page settings, formatted in the config's locale and zone", async () => {
      expect((await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite: true })).ok).toBe(true);
      expect((await issueAccessToken(test.ctx, { userId: alice, name: "Phone", canWrite: false })).ok).toBe(true);

      const props = await getTokenManagerProps({ userId: alice, now: NOW });

      expect(props.tools).toEqual([
        { name: "whoami", description: "Says whose account this is.", accessText: mcpAccessMessages.en.tools.read },
        { name: "add_note", description: "Adds a note.", accessText: mcpAccessMessages.en.tools.write },
      ]);
      expect(props.tokens.map((row) => ({ ...row, id: undefined })).sort((a, b) => a.name.localeCompare(b.name))).toEqual([
        {
          id: undefined,
          name: "Laptop",
          scopeText: "Read and change",
          statusText: "Active",
          isExpired: false,
          details: ["Created September 15, 2026", "Valid until December 14, 2026", "Not used yet"],
        },
        {
          id: undefined,
          name: "Phone",
          scopeText: "Read only",
          statusText: "Active",
          isExpired: false,
          details: ["Created September 15, 2026", "Valid until December 14, 2026", "Not used yet"],
        },
      ]);
      expect(props.allowWrites).toBe(true);
      expect(props.maxTokens).toBe(20);
      expect(props.messages).toEqual(mcpAccessMessages.en);
      expect(props.locale).toBe("en");
      expect("grants" in props).toBe(false);
    });

    it("marks a token past its expiry as expired", async () => {
      expect((await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite: false })).ok).toBe(true);

      const [row] = (await getTokenManagerProps({ userId: alice, now: new Date("2027-01-01T12:00:00Z") })).tokens;

      expect(row?.isExpired).toBe(true);
      expect(row?.statusText).toBe("Expired");
      expect(row?.details[1]).toBe("Expired on December 14, 2026");
    });

    it("lists only the given user's tokens", async () => {
      const bob = await createUser(test.database, "bob@example.com");
      expect((await issueAccessToken(test.ctx, { userId: bob, name: "Bob's laptop", canWrite: false })).ok).toBe(true);

      expect((await getTokenManagerProps({ userId: alice, now: NOW })).tokens).toEqual([]);
    });
  });

  describe("with OAuth on", () => {
    beforeEach(() => setUp(createConfig(OAUTH_OPTIONS)));

    it("lists the user's connected apps", async () => {
      await connectApp(test.ctx, alice, { clientName: "Assistant", canWrite: true });

      const props = await getTokenManagerProps({ userId: alice, now: NOW });

      expect(props.grants?.map((grant) => ({ ...grant, id: undefined }))).toEqual([
        { id: undefined, clientName: "Assistant", scopeText: "Read and change", details: ["Connected September 15, 2026", "Not used yet"] },
      ]);
    });
  });
});
