// Issue #315: what an adopting app wrote around createMcpEndpoint itself, now shipped by the package.
// One `describe` per point of the issue: tool results and the safe error boundary, server actions as
// write tools, the stdio entry, catalog parity, route constants and scheduled pruning. The issue gate
// of the token page is in adoption-gaps-315-next.test.ts, which stubs Next's request scope.
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { InMemoryTransport, McpServer, type JSONRPCMessage } from "@modelcontextprotocol/server";
import { err, ok, PublicError } from "@softure-ai/core";
import type { CommandDatabase } from "@softure-ai/db";
import { DEFAULT_MCP_ACCESS_ROUTES, type McpServerIdentity } from "@softure-ai/mcp-access";
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, MCP_ACCESS_USAGE, runMcpAccessCli } from "@softure-ai/mcp-access/cli";
import { actionTool, getMcpAccessRoutes, issueAccessToken, pruneMcpAccess, toolError, toolResult, withToolErrors } from "@softure-ai/mcp-access/server";
import { serveMcpStdio, type McpStdioHandle } from "@softure-ai/mcp-access/stdio";
import { expectToolCatalogMatchesServer, getToolCatalogDifferences } from "@softure-ai/mcp-access/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createConfig, createDemoServer, createTestMcp, createUser, OPTIONS, type TestMcp } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DRIZZLE_FAILURE = 'Failed query: select "id" from "orders" where "email" = $1\nparams: alice@example.com';

const text = (value: string) => ({ content: [{ type: "text", text: value }] });
const errorText = (value: string) => ({ content: [{ type: "text", text: value }], isError: true });

describe("tool results and the safe error boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("answers a string as text and anything else as JSON", () => {
    expect(toolResult("done")).toEqual(text("done"));
    expect(toolResult({ orders: [1, 2] })).toEqual(text('{"orders":[1,2]}'));
    expect(toolResult(null)).toEqual(text("null"));
  });

  it("marks an error result", () => {
    expect(toolError("No such order.")).toEqual(errorText("No such order."));
  });

  it("passes a tool result through and wraps a plain value", async () => {
    expect(await withToolErrors(() => toolError("kept"))).toEqual(errorText("kept"));
    expect(await withToolErrors(() => Promise.resolve([1]))).toEqual(text("[1]"));
  });

  it("unwraps a result value: the value on success, the hint or the code on failure", async () => {
    const hints = { "orders.not_found": "No order with that number." };
    expect(await withToolErrors(() => ok({ id: 7 }), { hints })).toEqual(text('{"id":7}'));
    expect(await withToolErrors(() => err("orders.not_found"), { hints })).toEqual(errorText("No order with that number."));
    expect(await withToolErrors(() => err("orders.locked"), { hints })).toEqual(errorText("orders.locked"));
  });

  it("gives the assistant a PublicError's message", async () => {
    const answer = await withToolErrors(() => {
      throw new PublicError("This plan has ended; pick another one.");
    });
    expect(answer).toEqual(errorText("This plan has ended; pick another one."));
  });

  it("never passes a failed query to the assistant or the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const answer = await withToolErrors(
      () => {
        throw new Error(DRIZZLE_FAILURE);
      },
      { label: "list_orders" },
    );
    expect(answer).toEqual(errorText("The database could not answer; try again later."));
    expect(log).toHaveBeenCalledExactlyOnceWith("@softure-ai/mcp-access: tool list_orders failed: Error");
    expect(JSON.stringify(log.mock.calls)).not.toContain("alice@example.com");
  });

  it("answers any other failure with the generic text, or the app's hint for its code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fail = () => Promise.reject(new TypeError("cannot read properties of undefined (reading 'secret')"));
    expect(await withToolErrors(fail)).toEqual(errorText("The tool failed; try again later."));
    expect(await withToolErrors(fail, { hints: { "core.unexpected": "Try again." } })).toEqual(errorText("Try again."));
  });
});

describe("a server action as a write tool", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the arguments as the form the action reads", async () => {
    const handler = vi.fn((form: FormData) => Promise.resolve({ ok: true, entries: [...form.entries()] }));
    await actionTool(handler)({
      name: "Alice",
      quantity: 2,
      gift: true,
      wrap: false,
      note: null,
      memo: undefined,
      tags: ["red", "blue"],
      deliverOn: new Date("2026-10-10T08:00:00Z"),
      address: { city: "Warsaw" },
    });
    expect(handler.mock.calls[0]?.[0] ? [...handler.mock.calls[0][0].entries()] : null).toEqual([
      ["name", "Alice"],
      ["quantity", "2"],
      ["gift", "on"],
      ["tags", "red"],
      ["tags", "blue"],
      ["deliverOn", "2026-10-10T08:00:00.000Z"],
      ["address", '{"city":"Warsaw"}'],
    ]);
  });

  it("answers the action's error as a tool error, through the hints", async () => {
    const hints = { "orders.out_of_stock": "That item is out of stock." };
    expect(await actionTool(() => Promise.resolve({ ok: false, error: "orders.out_of_stock" }), { hints })({})).toEqual(errorText("That item is out of stock."));
    expect(await actionTool(() => Promise.resolve({ status: "error", error: "auth.unauthenticated" }))({})).toEqual(errorText("auth.unauthenticated"));
  });

  it("answers success with the message, a message of the state, or the state", async () => {
    const created = () => Promise.resolve({ status: "ok", id: 42 });
    expect(await actionTool(created, { message: "Order placed." })({})).toEqual(text("Order placed."));
    expect(await actionTool(created, { message: (state) => `Order ${String((state as { id: number }).id)} placed.` })({})).toEqual(text("Order 42 placed."));
    expect(await actionTool(created)({})).toEqual(text('{"status":"ok","id":42}'));
  });

  it("keeps a thrown error away from the assistant", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const answer = await actionTool(() => Promise.reject(new Error(DRIZZLE_FAILURE)))({});
    expect(answer).toEqual(errorText("The database could not answer; try again later."));
  });

  it("registers as the callback of a tool with an input schema", () => {
    const server = new McpServer({ name: "acme", version: "1.0.0" });
    const tool = server.registerTool("add_note", { inputSchema: z.object({ text: z.string() }) }, actionTool(() => Promise.resolve({ ok: true })));
    expect(tool.enabled).toBe(true);
  });
});

describe("the stdio entry", () => {
  let test: TestMcp;
  let closed: number;
  let handles: McpStdioHandle[];

  beforeEach(async () => {
    test = await createTestMcp();
    closed = 0;
    handles = [];
  });
  afterEach(async () => {
    await Promise.all(handles.map((handle) => handle.close()));
    await test.database.close();
  });

  // The test database stays open across runs; the entry closes only its own handle.
  const openDatabase = (): Promise<CommandDatabase> =>
    Promise.resolve({
      handle: { kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve() },
      close: () => Promise.resolve(void (closed += 1)),
    });

  async function start(options: { env?: Record<string, string | undefined>; allowWrites?: boolean; config?: TestMcp["config"] } = {}) {
    const [client, server] = InMemoryTransport.createLinkedPair();
    const createServer = vi.fn(createDemoServer);
    const started = await serveMcpStdio({
      config: options.config ?? test.config,
      createServer,
      env: options.env ?? {},
      ...(options.allowWrites === undefined ? {} : { allowWrites: options.allowWrites }),
      transport: server,
      openDatabase,
    });
    if (started.ok) handles.push(started.value);
    return { started, client, createServer };
  }

  /** Initializes the connection and calls a tool, as a stdio MCP client does. */
  async function callWhoami(client: InMemoryTransport): Promise<unknown> {
    const answers = new Map<number, JSONRPCMessage>();
    client.onmessage = (message) => {
      if ("id" in message && typeof message.id === "number") answers.set(message.id, message);
    };
    await client.start();
    const waitFor = async (id: number) => {
      await vi.waitFor(() => expect(answers.has(id)).toBe(true));
      return answers.get(id);
    };
    await client.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } } });
    await waitFor(1);
    await client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    await client.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "whoami", arguments: {} } });
    const answer = (await waitFor(2)) as { result?: { content?: { text: string }[] } };
    return JSON.parse(answer.result?.content?.[0]?.text ?? "null");
  }

  it("serves the only account, read only by default", async () => {
    const alice = await createUser(test.database, "alice@example.com");
    const { started, client } = await start();
    expect(started.ok && started.value.identity).toEqual({ userId: alice, canWrite: false, tokenId: "stdio" });
    expect(await callWhoami(client)).toEqual({ userId: alice, canWrite: false });
  });

  it("writes only when both the entry and the app allow writes", async () => {
    await createUser(test.database, "alice@example.com");
    const writes = await start({ allowWrites: true });
    expect(writes.started.ok && writes.started.value.identity.canWrite).toBe(true);
    const appForbids = await start({ allowWrites: true, config: createConfig({ ...OPTIONS, allowWrites: false }) });
    expect(appForbids.started.ok && appForbids.started.value.identity.canWrite).toBe(false);
  });

  it("requires the env id when several accounts exist, and serves the one it names", async () => {
    await createUser(test.database, "alice@example.com");
    const bob = await createUser(test.database, "bob@example.com");
    const ambiguous = await start();
    expect(ambiguous.started).toEqual({
      ok: false,
      error: { code: "mcp-access.stdio_account_ambiguous", message: "@softure-ai/mcp-access: the database has several accounts; set MCP_USER_ID to the id of the one to serve" },
    });
    expect(closed).toBe(1);

    const named = await start({ env: { MCP_USER_ID: bob } });
    expect(named.started.ok && named.started.value.identity.userId).toBe(bob);
  });

  it("refuses an env id that names no account, before any lookup for a value that is no id", async () => {
    await createUser(test.database, "alice@example.com");
    for (const id of ["00000000-0000-4000-8000-000000000000", "alice; drop table auth.users"]) {
      const { started, createServer } = await start({ env: { MCP_USER_ID: id } });
      expect(started).toEqual({ ok: false, error: { code: "mcp-access.stdio_account_unknown", message: "@softure-ai/mcp-access: MCP_USER_ID names no account" } });
      expect(createServer).not.toHaveBeenCalled();
    }
  });

  it("refuses an empty database", async () => {
    const { started } = await start();
    expect(started).toEqual({ ok: false, error: { code: "mcp-access.stdio_no_account", message: "@softure-ai/mcp-access: the database has no account to serve" } });
  });

  it("closes its database when it is closed, and when the client goes away", async () => {
    await createUser(test.database, "alice@example.com");
    const closedHere = await start();
    if (!closedHere.started.ok) throw new Error("not started");
    await closedHere.started.value.close();
    expect(closed).toBe(1);

    const leftByClient = await start();
    expect(await callWhoami(leftByClient.client)).toMatchObject({ canWrite: false });
    await leftByClient.client.close();
    await vi.waitFor(() => expect(closed).toBe(2));
  });

  it("lets a factory that imports server-only run outside Next", () => {
    const register = join(import.meta.dirname, "../src/stdio/register.ts");
    const script = "await import('server-only'); console.log('loaded')";
    const run = (args: string[]) => spawnSync(process.execPath, [...args, "--input-type=module", "-e", script], { encoding: "utf8", cwd: import.meta.dirname });
    expect(run([]).status).not.toBe(0);
    expect(execFileSync(process.execPath, ["--import", register, "--input-type=module", "-e", script], { encoding: "utf8", cwd: import.meta.dirname, stdio: ["ignore", "pipe", "ignore"] })).toBe("loaded\n");
  });
});

describe("catalog parity", () => {
  const config = createConfig();

  it("finds no difference between the demo server and its catalog", async () => {
    expect(await getToolCatalogDifferences(config, createDemoServer)).toEqual({ missing: [], unlisted: [], writeForReaders: [] });
    await expect(expectToolCatalogMatchesServer(config, createDemoServer)).resolves.toBeUndefined();
  });

  it("names a configured tool the server lacks, a registered tool the catalog lacks and a write tool readers get", async () => {
    const createServer = (identity: McpServerIdentity) => {
      const server = new McpServer({ name: "acme", version: "1.0.0" });
      server.registerTool("add_note", { description: "Adds a note." }, () => toolResult("noted"));
      if (identity.canWrite) server.registerTool("export_all", { description: "Exports everything." }, () => toolResult("[]"));
      return server;
    };
    expect(await getToolCatalogDifferences(config, createServer)).toEqual({ missing: ["whoami"], unlisted: ["export_all"], writeForReaders: ["add_note"] });
    await expect(expectToolCatalogMatchesServer(config, createServer)).rejects.toThrow(
      "@softure-ai/mcp-access: the tool catalog in softure.config.ts does not match the MCP server: missing from the server: whoami; registered but not in the catalog: export_all; write tools a read-only token gets: add_note",
    );
  });

  it("takes an optional localized title and example per tool", () => {
    const tool = { name: "list_orders", access: "read" as const, description: { en: "Lists your orders." } };
    const parse = (extra: Record<string, unknown>) => () => createConfig({ serverName: "acme", tools: [{ ...tool, ...extra }] });
    expect(parse({ title: { en: "Orders" }, example: { en: "Show my last five orders.", pl: "Show my last five orders (pl)." } })).not.toThrow();
    expect(parse({ title: { en: "" } })).toThrow();
  });
});

describe("route constants", () => {
  it("are the routes the module mounts", () => {
    expect(DEFAULT_MCP_ACCESS_ROUTES).toEqual({
      page: "/account/mcp",
      endpoint: "/api/mcp",
      oauthConsent: "/oauth/authorize",
      oauthDecision: "/api/oauth/authorize",
      oauthToken: "/api/oauth/token",
      oauthRegister: "/api/oauth/register",
    });
    expect(getMcpAccessRoutes(createConfig())).toEqual(DEFAULT_MCP_ACCESS_ROUTES);
  });
});

describe("scheduled pruning", () => {
  let test: TestMcp;
  let closed: number;

  beforeEach(async () => {
    test = await createTestMcp();
    closed = 0;
    const alice = await createUser(test.database, "alice@example.com");
    for (const name of ["Laptop", "Phone"]) {
      const issued = await issueAccessToken(test.ctx, { userId: alice, name, canWrite: false });
      if (!issued.ok) throw new Error(issued.error);
    }
    test.clock.advance(91 * DAY_MS);
  });
  afterEach(() => test.database.close());

  it("prunes expired tokens and OAuth records in one call", async () => {
    expect(await pruneMcpAccess(test.ctx)).toEqual({ accessTokens: 2, codes: 0, grants: 0, clients: 0 });
    expect(await pruneMcpAccess(test.ctx)).toEqual({ accessTokens: 0, codes: 0, grants: 0, clients: 0 });
  });

  async function run(argv: string[], config = test.config) {
    const lines: string[] = [];
    const errors: string[] = [];
    const code = await runMcpAccessCli({
      config,
      argv,
      output: { log: (line) => lines.push(line), error: (line) => errors.push(line) },
      clock: test.clock,
      openDatabase: () =>
        Promise.resolve({
          handle: { kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve() },
          close: () => Promise.resolve(void (closed += 1)),
        }),
    });
    return { code, lines, errors };
  }

  it("runs as softure-mcp prune for a deploy maintain hook, then closes the connection", async () => {
    expect(await run(["prune"])).toEqual({
      code: EXIT_OK,
      lines: ["softure-mcp prune: removed 2 access tokens, 0 authorization codes, 0 grants, 0 clients"],
      errors: [],
    });
    expect(closed).toBe(1);
  });

  it("prints the usage for help and refuses an unknown command", async () => {
    expect(await run(["--help"])).toEqual({ code: EXIT_OK, lines: [MCP_ACCESS_USAGE], errors: [] });
    expect(await run(["purge"])).toEqual({ code: EXIT_USAGE, lines: [], errors: ['softure-mcp: unknown command "purge"', MCP_ACCESS_USAGE] });
    expect(closed).toBe(0);
  });

  it("fails without a database", async () => {
    const config = { ...test.config, database: null };
    expect(await run(["prune"], config)).toEqual({ code: EXIT_FAILED, lines: [], errors: ["softure-mcp prune: the config has no database; set database.url in softure.config"] });
  });

  it("reports a database it cannot use by the error's kind only", async () => {
    const lines: string[] = [];
    const errors: string[] = [];
    const code = await runMcpAccessCli({
      config: test.config,
      argv: ["prune"],
      output: { log: (line) => lines.push(line), error: (line) => errors.push(line) },
      openDatabase: () => Promise.reject(new Error("connect ECONNREFUSED 10.0.0.5:5432 password=secret")),
    });
    expect({ code, lines, errors }).toEqual({ code: EXIT_FAILED, lines: [], errors: ["softure-mcp prune: failed: Error"] });
  });
});

