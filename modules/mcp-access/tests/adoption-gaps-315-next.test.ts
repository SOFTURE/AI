// Issue #315, point 6: the token page's issue action with an app gate (a billing write gate) in front
// of it, without copying the action. Next's request scope is stubbed: the signed-in user, the config,
// the request headers and `getConfiguredDatabase`, which hands the module the PGlite test database.
import { err, ok, type SoftureConfig } from "@softure-ai/core";
import type { Database } from "@softure-ai/db";
import { getTokenErrorMessage, mcpAccessMessages } from "@softure-ai/mcp-access";
import { issueToken, issueTokenAction } from "@softure-ai/mcp-access/next";
import { listAccessTokens } from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestMcp, createUser, type TestMcp } from "./support.js";

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

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("issuing a token behind the app's gate", () => {
  let test: TestMcp;
  let alice: string;

  beforeEach(async () => {
    test = await createTestMcp();
    alice = await createUser(test.database, "alice@example.com");
    scope.config = test.config;
    scope.db = test.database.db;
    scope.user = { id: alice };
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  it("asks the gate with the owner and the requested access, then issues", async () => {
    const beforeIssue = vi.fn(() => Promise.resolve(ok()));
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop", canWrite: "on" }), { beforeIssue });
    expect(beforeIssue).toHaveBeenCalledExactlyOnceWith({ userId: alice, canWrite: true });
    expect(state.status).toBe("ok");
    expect((await listAccessTokens(test.ctx, alice)).map((token) => token.name)).toEqual(["Laptop"]);
  });

  it("issues nothing when the gate refuses, and the page has copy for each refusal", async () => {
    for (const code of ["mcp-access.write_refused", "mcp-access.issue_refused"] as const) {
      const state = await issueToken({ status: "idle" }, form({ name: "Laptop", canWrite: "on" }), { beforeIssue: () => err(code) });
      expect(state).toEqual({ status: "error", error: code });
      expect(getTokenErrorMessage(mcpAccessMessages.en, code)).not.toBe(getTokenErrorMessage(mcpAccessMessages.en, "core.unexpected"));
      expect(getTokenErrorMessage(mcpAccessMessages.pl, code)).not.toBe(getTokenErrorMessage(mcpAccessMessages.en, code));
    }
    expect(await listAccessTokens(test.ctx, alice)).toEqual([]);
  });

  it("turns a gate that throws into a safe error code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }), { beforeIssue: () => Promise.reject(new Error("billing api down: key=sk_live")) });
    expect(state).toEqual({ status: "error", error: "core.unexpected" });
    expect(await listAccessTokens(test.ctx, alice)).toEqual([]);
  });

  it("never asks the gate without a session", async () => {
    scope.user = null;
    const beforeIssue = vi.fn(() => ok());
    expect(await issueToken({ status: "idle" }, form({ name: "Laptop" }), { beforeIssue })).toEqual({ status: "error", error: "auth.unauthenticated" });
    expect(beforeIssue).not.toHaveBeenCalled();
  });

  it("keeps the ready-made action ungated", async () => {
    const state = await issueTokenAction({ status: "idle" }, form({ name: "Phone" }));
    expect(state.status).toBe("ok");
  });
});
