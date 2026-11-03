// Operation tools with a context getter (#990): a server factory that resolves `{ db, clock, config }` per call
// registers `get_operation`, `cancel_operation` and the task handlers without opening anything, and an app that wraps
// `getOperation` itself answers with the module's sentences.
import { createMcpHandler, McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { jobs } from "@softure-ai/jobs";
import type { JobsContext } from "@softure-ai/jobs/server";
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import {
  getOperation,
  getOperationErrorHints,
  registerOperationCancelTool,
  registerOperationStatusTool,
  registerOperationTasks,
  startOperation,
  type OperationAnswer,
  type OperationToolContext,
} from "@softure-ai/mcp-access/jobs";
import { withToolErrors } from "@softure-ai/mcp-access/server";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig, createTestMcp, createUser, OPTIONS, type TestMcp } from "./support.js";

const QUEUE = "video.render";
const TASKS = "io.modelcontextprotocol/tasks";
const MODERN = "2026-07-28";
const NOT_FOUND = "No operation with this id belongs to this account.";
const FINISHED = "The operation has already ended, so it cannot be cancelled.";
const STATUS_DESCRIPTION =
  "Tells how a long operation started by another tool is going: queued, running (with its progress), succeeded (with its result), failed (with an error code) or cancelled. Call it again after pollAfterSeconds while the operation runs.";


interface RpcAnswer {
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code: number; readonly message: string };
}

interface Getter {
  readonly getContext: () => Promise<JobsContext>;
  readonly calls: () => number;
}

function countCalls(resolve: () => Promise<JobsContext>): Getter {
  let calls = 0;
  return {
    getContext: () => {
      calls += 1;
      return resolve();
    },
    calls: () => calls,
  };
}

function readText(result: CallToolResult): string {
  const [content] = result.content;
  if (content?.type !== "text") throw new Error("the tool answered no text");
  return content.text;
}

describe("operation tools with a context getter", () => {
  let test: TestMcp | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  async function setUp(): Promise<{ current: TestMcp; alice: McpServerIdentity }> {
    const current = await createTestMcp(createConfig(OPTIONS, "en", [jobs({ queues: { [QUEUE]: { maxAttempts: 3 } } })]));
    test = current;
    const alice = { userId: await createUser(current.database, "alice@example.com"), canWrite: true, tokenId: "token-a" };
    return { current, alice };
  }

  /** One JSON-RPC request through the SDK in JSON mode on revision 2026-07-28, the Tasks extension declared. */
  async function send(build: () => McpServer, method: string, params: Record<string, unknown>): Promise<RpcAnswer> {
    const handler = createMcpHandler(build, { responseMode: "json" });
    const headers = new Headers({ "content-type": "application/json", accept: "application/json, text/event-stream" });
    headers.set("mcp-protocol-version", MODERN);
    headers.set("mcp-method", method);
    const name = params["name"] ?? params["taskId"];
    if (typeof name === "string") headers.set("mcp-name", name);
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MODERN,
          "io.modelcontextprotocol/clientInfo": { name: "assistant", version: "1.0.0" },
          "io.modelcontextprotocol/clientCapabilities": { extensions: { [TASKS]: {} } },
        },
      },
    };
    const response = await handler.fetch(new Request("http://localhost/api/mcp", { method: "POST", headers, body: JSON.stringify(body) }));
    const text = await response.text();
    const data = text.startsWith("event:") ? (text.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : text;
    return JSON.parse(data) as RpcAnswer;
  }

  function buildServer(source: OperationToolContext, identity: McpServerIdentity): McpServer {
    const server = new McpServer({ name: "acme", version: "1.0.0" });
    registerOperationStatusTool(server, { ...source, identity });
    registerOperationCancelTool(server, { ...source, identity });
    return server;
  }

  async function callTool(source: OperationToolContext, identity: McpServerIdentity, name: string, operationId: string): Promise<CallToolResult> {
    const answer = await send(() => buildServer(source, identity), "tools/call", { name, arguments: { operationId } });
    if (answer.result === undefined) throw new Error(`tools/call failed: ${answer.error?.message ?? "no answer"}`);
    return answer.result as unknown as CallToolResult;
  }

  async function start(current: TestMcp, identity: McpServerIdentity): Promise<string> {
    const result = await startOperation(current.ctx, identity, { queue: QUEUE, payload: { videoId: "v1" } });
    return (JSON.parse(readText(result)) as OperationAnswer).operationId;
  }

  it("registers and lists the tools without resolving the context", async () => {
    const { current, alice } = await setUp();
    const getter = countCalls(() => Promise.resolve(current.ctx));

    const answer = await send(() => buildServer({ getContext: getter.getContext }, alice), "tools/list", {});

    const tools = answer.result?.["tools"] as readonly { readonly name: string; readonly description: string }[];
    expect(tools.map((tool) => [tool.name, tool.description === STATUS_DESCRIPTION])).toEqual([
      ["get_operation", true],
      ["cancel_operation", false],
    ]);
    expect(getter.calls()).toBe(0);
  });

  it("resolves the context once per call and answers the status as with ctx", async () => {
    const { current, alice } = await setUp();
    const operationId = await start(current, alice);
    const getter = countCalls(() => Promise.resolve(current.ctx));

    const viaGetter = await callTool({ getContext: getter.getContext }, alice, "get_operation", operationId);
    const viaCtx = await callTool({ ctx: current.ctx }, alice, "get_operation", operationId);

    expect(getter.calls()).toBe(1);
    expect(viaGetter.isError).toBeUndefined();
    expect(JSON.parse(readText(viaGetter))).toEqual(JSON.parse(readText(viaCtx)));
    expect((JSON.parse(readText(viaGetter)) as OperationAnswer).status).toBe("queued");
  });

  it("answers another account's operation with the module's not-found sentence", async () => {
    const { current, alice } = await setUp();
    const operationId = await start(current, alice);
    const bob = { userId: await createUser(current.database, "bob@example.com"), canWrite: true, tokenId: "token-b" };

    const result = await callTool({ getContext: () => Promise.resolve(current.ctx) }, bob, "get_operation", operationId);

    expect([result.isError, readText(result)]).toEqual([true, NOT_FOUND]);
  });

  it("cancels through the getter, and refuses an ended operation with the module's sentence", async () => {
    const { current, alice } = await setUp();
    const operationId = await start(current, alice);
    const source = { getContext: () => Promise.resolve(current.ctx) };

    const cancelled = await callTool(source, alice, "cancel_operation", operationId);
    const again = await callTool(source, alice, "cancel_operation", operationId);

    expect((JSON.parse(readText(cancelled)) as OperationAnswer).status).toBe("cancelled");
    expect([again.isError, readText(again)]).toEqual([true, FINISHED]);
  });

  it("answers a failing getter as a safe tool error", async () => {
    const { alice } = await setUp();
    const source = { getContext: () => Promise.reject(new Error("connect ECONNREFUSED 10.0.0.5:5432")) };

    const result = await callTool(source, alice, "get_operation", "1");

    expect(result.isError).toBe(true);
    expect(readText(result)).not.toContain("10.0.0.5");
  });

  it("takes the description from the config given at registration, and the hints from the config of the call", async () => {
    const { current, alice } = await setUp();
    const messages = { en: { operations: { statusToolDescription: "Follows a render.", notFound: "No such render." } } };
    const config = createConfig({ ...OPTIONS, messages }, "en", [jobs({ queues: { [QUEUE]: { maxAttempts: 3 } } })]);
    const source = { getContext: () => Promise.resolve({ ...current.ctx, config }), config };

    const listed = await send(() => buildServer(source, alice), "tools/list", {});
    const missing = await callTool(source, alice, "get_operation", "1");

    const tools = listed.result?.["tools"] as readonly { readonly name: string; readonly description: string }[];
    expect(tools.find((tool) => tool.name === "get_operation")?.description).toBe("Follows a render.");
    expect([missing.isError, readText(missing)]).toEqual([true, "No such render."]);
  });

  it("serves tasks/get through the getter", async () => {
    const { current, alice } = await setUp();
    const getter = countCalls(() => Promise.resolve(current.ctx));
    const build = (): McpServer => {
      const server = new McpServer({ name: "acme", version: "1.0.0" });
      server.registerTool("render_video", { inputSchema: z.object({ videoId: z.string() }) }, (input, taskRequest) =>
        startOperation(current.ctx, alice, { queue: QUEUE, payload: input, taskRequest }),
      );
      registerOperationTasks(server, { getContext: getter.getContext, identity: alice });
      return server;
    };

    const started = await send(build, "tools/call", { name: "render_video", arguments: { videoId: "v1" } });
    const taskId = started.result?.["taskId"];
    if (typeof taskId !== "string") throw new Error(`no task: ${JSON.stringify(started)}`);
    expect(getter.calls()).toBe(0);
    const task = await send(build, "tasks/get", { taskId });

    expect(task.result).toMatchObject({ taskId, status: "working" });
    expect(getter.calls()).toBe(1);
  });

  it("exports the operation error hints for an app's own tools", async () => {
    const { current, alice } = await setUp();

    const result = await withToolErrors(() => getOperation(current.ctx, alice, "1"), { hints: getOperationErrorHints(current.ctx.config) });

    expect(getOperationErrorHints(current.ctx.config)).toEqual({ "mcp-access.operation_not_found": NOT_FOUND, "mcp-access.operation_finished": FINISHED });
    expect([result.isError, readText(result)]).toEqual([true, NOT_FOUND]);
  });
});
