// Issue #961: the token page issues API tokens (`kind=api` with ticked `scope:<name>` fields), shows them
// once with the app's examples, lists both kinds and hands the gate the kind and scopes. Next's request
// scope is stubbed as in adoption-gaps-315-next.test.ts.
import { err, ok, type SoftureConfig } from "@softure-ai/core";
import type { Database } from "@softure-ai/db";
import { mcpAccessMessages, type McpAccessOptionsInput } from "@softure-ai/mcp-access";
import { getTokenManagerProps, issueToken, issueTokenAction } from "@softure-ai/mcp-access/next";
import { listAccessTokens } from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMcp, createUser, OPTIONS, type TestMcp } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  db: Database | undefined;
  user: { id: string } | null;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, db: undefined, user: null }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("@softure-ai/auth/next", () => ({ getCurrentUser: () => Promise.resolve(scope.user) }));
vi.mock("@softure-ai/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@softure-ai/db")>()),
  getConfiguredDatabase: () => {
    if (scope.db === undefined) throw new Error("test: no database registered");
    return Promise.resolve({ db: scope.db });
  },
}));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers({ host: "localhost:3000" })) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const API_OPTIONS: McpAccessOptionsInput = {
  ...OPTIONS,
  apiTokens: {
    prefix: "acme_",
    scopes: [
      { name: "recipes:read", access: "read", description: { en: "Reads your recipes." } },
      { name: "recipes:write", access: "write", description: { en: "Adds recipes." } },
    ],
    examples: [{ title: { en: "curl" }, text: { en: "curl -H 'Authorization: Bearer {token}' {appOrigin}/api/recipes" } }],
  },
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("API tokens on the token page (#961)", () => {
  let test: TestMcp;
  let alice: string;

  beforeEach(async () => {
    test = await createTestMcp(createConfig(API_OPTIONS));
    alice = await createUser(test.database, "alice@example.com");
    scope.config = test.config;
    scope.db = test.database.db;
    scope.user = { id: alice };
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  it("issues an API token with the ticked scopes and reveals it once with the filled examples", async () => {
    const state = await issueTokenAction({ status: "idle" }, form({ kind: "api", name: "Shortcut", "scope:recipes:write": "on", canWrite: "on" }));
    if (state.status !== "api-ok") throw new Error(`expected api-ok, got ${JSON.stringify(state)}`);
    const { token } = state.issued;
    expect(token).toMatch(/^acme_[A-Za-z0-9_-]{43}$/);
    expect([state.issued.name, state.issued.scopes, state.issued.authorizationHeader]).toEqual(["Shortcut", ["recipes:write"], `Bearer ${token}`]);
    expect(state.issued.examples).toEqual([{ title: "curl", text: `curl -H 'Authorization: Bearer ${token}' http://localhost:3000/api/recipes` }]);
    const [stored] = await listAccessTokens({ db: test.database.db, clock: test.clock, config: test.config }, alice);
    expect([stored?.kind, stored?.scopes]).toEqual(["api", ["recipes:write"]]);
  });

  it("answers the form's errors: no scope, an undeclared scope", async () => {
    expect(await issueTokenAction({ status: "idle" }, form({ kind: "api", name: "Shortcut" }))).toEqual({ status: "error", error: "mcp-access.scope_required" });
    expect(await issueTokenAction({ status: "idle" }, form({ kind: "api", name: "Shortcut", "scope:orders:read": "on" }))).toEqual({
      status: "error",
      error: "mcp-access.scope_unknown",
    });
  });

  it("hands the gate the kind, the scopes and whether one of them writes", async () => {
    const beforeIssue = vi.fn(() => ok());
    await issueToken({ status: "idle" }, form({ kind: "api", name: "Shortcut", "scope:recipes:read": "on", "scope:recipes:write": "on" }), { beforeIssue });
    expect(beforeIssue).toHaveBeenCalledExactlyOnceWith({ userId: alice, canWrite: true, kind: "api", scopes: ["recipes:read", "recipes:write"] });
    const refused = await issueToken({ status: "idle" }, form({ kind: "api", name: "x", "scope:recipes:write": "on" }), { beforeIssue: () => err("mcp-access.write_refused") });
    expect(refused).toEqual({ status: "error", error: "mcp-access.write_refused" });
  });

  it("builds the page data with both kinds named and the app's scopes", async () => {
    await issueTokenAction({ status: "idle" }, form({ name: "Laptop" }));
    test.clock.advance(60_000);
    await issueTokenAction({ status: "idle" }, form({ kind: "api", name: "Shortcut", "scope:recipes:read": "on" }));
    const props = await getTokenManagerProps({ userId: alice, config: test.config, now: test.clock.now() });
    const en = mcpAccessMessages.en;
    expect(props.tokens.map((row) => [row.name, row.kindText, row.scopeText])).toEqual([
      ["Shortcut", en.list.kindApi, "recipes:read"],
      ["Laptop", en.list.kindMcp, en.list.readOnly],
    ]);
    expect(props.apiScopes).toEqual([
      { name: "recipes:read", description: "Reads your recipes.", accessText: en.apiScopes.read, isOffered: true },
      { name: "recipes:write", description: "Adds recipes.", accessText: en.apiScopes.write, isOffered: true },
    ]);
  });

  it("leaves the page as it was for an app without apiTokens", async () => {
    scope.config = createConfig(OPTIONS);
    await issueTokenAction({ status: "idle" }, form({ name: "Laptop" }));
    const props = await getTokenManagerProps({ userId: alice, config: scope.config });
    expect(props.apiScopes).toBeUndefined();
    expect(props.tokens[0]?.kindText).toBeUndefined();
    expect(await issueTokenAction({ status: "idle" }, form({ kind: "api", name: "x", "scope:recipes:read": "on" }))).toEqual({ status: "error", error: "mcp-access.api_disabled" });
  });
});
