// Issue #386: what kept an adopting app on its own token-issue action instead of `issueToken`. The name
// its users' MCP clients already list the server under, the gate's own refusal text, and the expiry as a
// date. Next's request scope is stubbed as in adoption-gaps-315-next.test.ts.
import { err, ok, PublicError, type SoftureConfig } from "@softure-ai/core";
import type { Database } from "@softure-ai/db";
import { issueToken, refuseIssue } from "@softure-ai/mcp-access/next";
import { listAccessTokens } from "@softure-ai/mcp-access/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

let test: TestMcp;
let alice: string;
/** The database of the current test, when it opened one. */
let opened: TestMcp | undefined;

async function signIn(config: SoftureConfig = createConfig()): Promise<void> {
  test = await createTestMcp(config);
  opened = test;
  alice = await createUser(test.database, "alice@example.com");
  scope.config = test.config;
  scope.db = test.database.db;
  scope.user = { id: alice };
}

afterEach(async () => {
  await opened?.database.close();
  opened = undefined;
  vi.restoreAllMocks();
});

describe("the name in the client setup", () => {
  it("registers the server under clientServerName in every snippet", async () => {
    await signIn(createConfig({ ...OPTIONS, clientServerName: "acme-app" }));
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }));
    if (state.status !== "ok") throw new Error(`expected a token, got ${JSON.stringify(state)}`);
    const { setup } = state.issued;
    expect(setup.serverName).toBe("acme-app");
    expect(setup.claudeCodeCommand).toContain("--scope user acme-app http://localhost:3000/api/mcp");
    expect(Object.keys((JSON.parse(setup.jsonConfig) as { mcpServers: object }).mcpServers)).toEqual(["acme-app"]);
    expect(Object.keys((JSON.parse(setup.desktopConfig) as { mcpServers: object }).mcpServers)).toEqual(["acme-app"]);
    expect(setup.assistantPrompt).toContain('the server "acme-app" is connected');
  });

  it("keeps serverName when the option is not set", async () => {
    await signIn();
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }));
    if (state.status !== "ok") throw new Error(`expected a token, got ${JSON.stringify(state)}`);
    expect(state.issued.setup.serverName).toBe("acme");
    expect(state.issued.setup.claudeCodeCommand).toContain("--scope user acme http://");
  });

  it("refuses a name that is not a shell word", () => {
    for (const clientServerName of ["plan majatku", 'acme"', "Acme", ""]) {
      expect(() => createConfig({ ...OPTIONS, clientServerName })).toThrow(/clientServerName/);
    }
  });
});

describe("the gate's own refusal text", () => {
  it("passes a refusal with a message through next to its code", async () => {
    await signIn();
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop", canWrite: "on" }), {
      beforeIssue: () => refuseIssue("mcp-access.write_refused", "Your trial has ended."),
    });
    expect(state).toEqual({ status: "error", error: "mcp-access.write_refused", message: "Your trial has ended." });
    expect(await listAccessTokens(test.ctx, alice)).toEqual([]);
  });

  it("drops a blank message and keeps the code", async () => {
    await signIn();
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }), {
      beforeIssue: () => Promise.resolve(refuseIssue("mcp-access.issue_refused", "  ")),
    });
    expect(state).toEqual({ status: "error", error: "mcp-access.issue_refused" });
  });

  it("shows a thrown PublicError's message as an issue refusal, without logging a failure", async () => {
    await signIn();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }), {
      beforeIssue: () => Promise.reject(new PublicError("Your account is read-only.")),
    });
    expect(state).toEqual({ status: "error", error: "mcp-access.issue_refused", message: "Your account is read-only." });
    expect(log).not.toHaveBeenCalled();
    expect(await listAccessTokens(test.ctx, alice)).toEqual([]);
  });

  it("still hides the text of any other thrown error", async () => {
    await signIn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }), {
      beforeIssue: () => {
        throw new Error("billing api down: key=sk_live");
      },
    });
    expect(state).toEqual({ status: "error", error: "core.unexpected" });
  });

  it("keeps a bare code refusal as it was", async () => {
    await signIn();
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }), { beforeIssue: () => err("mcp-access.issue_refused") });
    expect(state).toEqual({ status: "error", error: "mcp-access.issue_refused" });
  });

  it("lets the token through on ok()", async () => {
    await signIn();
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }), { beforeIssue: () => ok() });
    expect(state.status).toBe("ok");
  });
});

describe("the expiry as a date", () => {
  it("returns expiresAt as ISO 8601, the stored expiry", async () => {
    await signIn();
    const state = await issueToken({ status: "idle" }, form({ name: "Laptop" }));
    if (state.status !== "ok") throw new Error(`expected a token, got ${JSON.stringify(state)}`);
    const [stored] = await listAccessTokens(test.ctx, alice);
    expect(state.issued.expiresAt).toBe(stored?.expiresAt.toISOString());
  });
});
