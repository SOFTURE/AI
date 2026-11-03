// Long operations as MCP Tasks (#977): a client that declares the Tasks extension (revision 2026-07-28) on a tool call
// gets a task and follows it through `tasks/get`; every other client keeps the operation id of #952.
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { failJob, defineJobHandler, jobs, jobsTable, type JobHandlers } from "@softure-ai/jobs";
import { claimJobs, getJob } from "@softure-ai/jobs/server";
import { runDueJobs } from "@softure-ai/jobs/testing";
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import { registerOperationStatusTool, registerOperationTasks, startOperation, type ReadOperationResult } from "@softure-ai/mcp-access/jobs";
import { deleteMcpAccessUserData, pruneMcpAccess } from "@softure-ai/mcp-access/server";
import { ok } from "@softure-ai/core";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig, createTestMcp, createUser, OPTIONS, type TestMcp } from "./support.js";

const QUEUE = "video.render";
const TASKS = "io.modelcontextprotocol/tasks";
const MODERN = "2026-07-28";
const DAY_MS = 86_400_000;
const NOT_FOUND = { code: -32602, message: "Failed to retrieve task: Task not found" };

interface RpcAnswer {
  readonly status: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code: number; readonly message: string; readonly data?: unknown };
}

const handlers = {
  [QUEUE]: defineJobHandler({
    payload: z.object({ videoId: z.string(), fail: z.boolean().optional() }),
    run: (payload) => Promise.resolve(payload.fail === true ? failJob("video.encode_failed") : ok()),
  }),
} satisfies JobHandlers;

describe("long operations as MCP Tasks", () => {
  let test: TestMcp | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  async function setUp(): Promise<{ current: TestMcp; alice: McpServerIdentity; bob: McpServerIdentity }> {
    const current = await createTestMcp(createConfig(OPTIONS, "en", [jobs({ queues: { [QUEUE]: { maxAttempts: 3 } } })]));
    test = current;
    const alice = { userId: await createUser(current.database, "alice@example.com"), canWrite: true, tokenId: "token-a" };
    const bob = { userId: await createUser(current.database, "bob@example.com"), canWrite: true, tokenId: "token-b" };
    return { current, alice, bob };
  }

  /** One JSON-RPC request through the SDK in JSON mode, on revision 2026-07-28 or as a 2025-era client. */
  async function send(
    current: TestMcp,
    identity: McpServerIdentity,
    request: { readonly method: string; readonly params: Record<string, unknown>; readonly tasks?: boolean; readonly legacy?: boolean },
    readResult?: ReadOperationResult,
  ): Promise<RpcAnswer> {
    const handler = createMcpHandler(
      () => {
        const server = new McpServer({ name: "acme", version: "1.0.0" });
        server.registerTool("render_video", { inputSchema: z.object({ videoId: z.string(), fail: z.boolean().optional() }) }, (input, taskRequest) =>
          startOperation(current.ctx, identity, { queue: QUEUE, payload: input, dedupKey: `video:${input.videoId}`, taskRequest }),
        );
        registerOperationStatusTool(server, { ctx: current.ctx, identity });
        registerOperationTasks(server, { ctx: current.ctx, identity, ...(readResult === undefined ? {} : { readResult }) });
        return server;
      },
      { responseMode: "json" },
    );
    const headers = new Headers({ "content-type": "application/json", accept: "application/json, text/event-stream" });
    const params: Record<string, unknown> = { ...request.params };
    if (request.legacy !== true) {
      headers.set("mcp-protocol-version", MODERN);
      headers.set("mcp-method", request.method);
      const name = request.params["name"] ?? request.params["taskId"];
      if (typeof name === "string") headers.set("mcp-name", name);
      params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": MODERN,
        "io.modelcontextprotocol/clientInfo": { name: "assistant", version: "1.0.0" },
        "io.modelcontextprotocol/clientCapabilities": request.tasks === false ? {} : { extensions: { [TASKS]: {} } },
      };
    }
    const response = await handler.fetch(
      new Request("http://localhost/api/mcp", { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: request.method, params }) }),
    );
    const text = await response.text();
    const data = text.startsWith("event:") ? (text.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : text;
    return { status: response.status, ...(JSON.parse(data) as Omit<RpcAnswer, "status">) };
  }

  function render(current: TestMcp, identity: McpServerIdentity, options: { readonly videoId?: string; readonly fail?: boolean; readonly tasks?: boolean; readonly legacy?: boolean } = {}) {
    const args = { videoId: options.videoId ?? "v1", ...(options.fail === undefined ? {} : { fail: options.fail }) };
    return send(current, identity, {
      method: "tools/call",
      params: { name: "render_video", arguments: args },
      ...(options.tasks === undefined ? {} : { tasks: options.tasks }),
      ...(options.legacy === undefined ? {} : { legacy: options.legacy }),
    });
  }

  async function startTask(current: TestMcp, identity: McpServerIdentity, options: { readonly videoId?: string; readonly fail?: boolean } = {}): Promise<string> {
    const answer = await render(current, identity, options);
    const taskId = answer.result?.["taskId"];
    if (typeof taskId !== "string") throw new Error(`no task: ${JSON.stringify(answer)}`);
    return taskId;
  }

  async function findJobId(current: TestMcp, taskId: string): Promise<string> {
    const rows = await current.database.client.query<{ job_id: string }>("SELECT job_id::text FROM mcp.operation_tasks WHERE task_id = $1", [taskId]);
    const jobId = rows.rows[0]?.job_id;
    if (jobId === undefined) throw new Error(`no row for task ${taskId}`);
    return jobId;
  }

  function getTask(current: TestMcp, identity: McpServerIdentity, taskId: string, options: { readonly tasks?: boolean; readonly readResult?: ReadOperationResult } = {}) {
    return send(current, identity, { method: "tasks/get", params: { taskId }, ...(options.tasks === undefined ? {} : { tasks: options.tasks }) }, options.readResult);
  }

  function readContent(result: Record<string, unknown> | undefined): unknown {
    const content = (result?.["content"] as { type: string; text: string }[] | undefined)?.[0];
    if (content?.type !== "text") throw new Error("no text content");
    return JSON.parse(content.text);
  }

  it("declares the Tasks extension in server/discover", async () => {
    const { current, alice } = await setUp();
    const answer = await send(current, alice, { method: "server/discover", params: {} });
    expect(answer.result?.["capabilities"]).toMatchObject({ extensions: { [TASKS]: {} } });
  });

  it("answers a declaring client with a stored task: a random id, working, a day to live and the first wait", async () => {
    const { current, alice } = await setUp();
    const answer = await render(current, alice);

    expect(answer.result).toMatchObject({
      resultType: "task",
      status: "working",
      statusMessage: "The operation is waiting to start.",
      createdAt: current.clock.now().toISOString(),
      ttlMs: DAY_MS,
      pollIntervalMs: 2000,
    });
    const taskId = answer.result?.["taskId"] as string;
    expect(taskId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const job = await getJob(current.ctx, await findJobId(current, taskId));
    expect(job).toMatchObject({ queue: QUEUE, origin: "mcp", dedupKey: `mcp:${alice.userId}:video:v1` });
  });

  it("keeps the operation id for a 2026 client without the extension and for a 2025-era client", async () => {
    const { current, alice } = await setUp();
    for (const answer of [await render(current, alice, { tasks: false }), await render(current, alice, { videoId: "v2", legacy: true })]) {
      expect(answer.result?.["resultType"] === "task").toBe(false);
      expect(readContent(answer.result)).toMatchObject({ operationId: expect.any(String) as string, status: "queued" });
    }
    const rows = await current.database.client.query<{ n: number }>("SELECT count(*)::int AS n FROM mcp.operation_tasks");
    expect(rows.rows[0]?.n).toBe(0);
  });

  it("gives the same account the same task when it joins a running operation, and another account its own", async () => {
    const { current, alice, bob } = await setUp();
    const first = await startTask(current, alice);
    await claimJobs(current.ctx, { queue: QUEUE, limit: 10, workerId: "worker-1" });
    current.clock.advance(60_000);

    const again = await render(current, alice);
    expect(again.result).toMatchObject({ taskId: first, status: "working", statusMessage: "The operation is running.", pollIntervalMs: 15_000 });
    expect(await startTask(current, bob)).not.toBe(first);
  });

  it("follows a task while it runs, with the operation's growing wait", async () => {
    const { current, alice } = await setUp();
    const taskId = await startTask(current, alice);
    await claimJobs(current.ctx, { queue: QUEUE, limit: 10, workerId: "worker-1" });
    current.clock.advance(60_000);

    const answer = await getTask(current, alice, taskId);
    expect(answer.result).toMatchObject({ resultType: "complete", taskId, status: "working", statusMessage: "The operation is running.", ttlMs: DAY_MS, pollIntervalMs: 15_000 });
  });

  it("completes a task with the operation's answer and the app's result", async () => {
    const { current, alice } = await setUp();
    const taskId = await startTask(current, alice);
    expect(await runDueJobs(current.ctx, { handlers })).toMatchObject({ succeeded: 1 });
    const jobId = await findJobId(current, taskId);

    const answer = await getTask(current, alice, taskId, { readResult: (job) => ({ url: `https://cdn.example.com/${job.id}.mp4` }) });
    expect(answer.result).toMatchObject({ taskId, status: "completed", statusMessage: "The operation has finished." });
    expect(answer.result?.["pollIntervalMs"]).toBeUndefined();
    const result = answer.result?.["result"] as Record<string, unknown>;
    expect(result["isError"]).toBeUndefined();
    expect(readContent(result)).toEqual({
      operationId: jobId,
      status: "succeeded",
      progress: null,
      result: { url: `https://cdn.example.com/${jobId}.mp4` },
      message: "The operation has finished.",
    });
  });

  it("completes a task of a failed operation as a tool error, not as a failed task", async () => {
    const { current, alice } = await setUp();
    const taskId = await startTask(current, alice, { fail: true });
    expect(await runDueJobs(current.ctx, { handlers })).toMatchObject({ failed: 1 });

    const answer = await getTask(current, alice, taskId);
    expect(answer.result).toMatchObject({ status: "completed", statusMessage: "The operation failed. Tell the user; start it again only if they ask." });
    const result = answer.result?.["result"] as Record<string, unknown>;
    expect(result["isError"]).toBe(true);
    expect(readContent(result)).toMatchObject({ status: "failed", errorCode: "video.encode_failed" });
  });

  it("cancels a queued task at once and acknowledges with an empty result", async () => {
    const { current, alice } = await setUp();
    const taskId = await startTask(current, alice);

    const cancelled = await send(current, alice, { method: "tasks/cancel", params: { taskId } });
    expect(cancelled.result).toEqual({ resultType: "complete", _meta: expect.any(Object) as object });
    expect((await getJob(current.ctx, await findJobId(current, taskId)))?.status).toBe("cancelled");
    expect((await getTask(current, alice, taskId)).result).toMatchObject({ status: "cancelled", statusMessage: "The operation was cancelled." });
  });

  it("asks a running task to stop and says so while it ends", async () => {
    const { current, alice } = await setUp();
    const taskId = await startTask(current, alice);
    await claimJobs(current.ctx, { queue: QUEUE, limit: 10, workerId: "worker-1" });

    expect((await send(current, alice, { method: "tasks/cancel", params: { taskId } })).error).toBeUndefined();
    expect((await getTask(current, alice, taskId)).result).toMatchObject({ status: "working", statusMessage: "The operation was asked to stop and will end shortly." });
  });

  it("acknowledges cancelling a task that has ended, and refuses it to a read-only token", async () => {
    const { current, alice } = await setUp();
    const taskId = await startTask(current, alice);
    await runDueJobs(current.ctx, { handlers });

    expect((await send(current, alice, { method: "tasks/cancel", params: { taskId } })).error).toBeUndefined();
    const readOnly = await send(current, { ...alice, canWrite: false }, { method: "tasks/cancel", params: { taskId } });
    expect(readOnly.error).toMatchObject({ code: -32600, message: "Cancelling a task needs a token with write access" });
    expect((await getTask(current, alice, taskId)).result).toMatchObject({ status: "completed" });
  });

  it("acknowledges tasks/update of an owned task, since operations never ask for input", async () => {
    const { current, alice, bob } = await setUp();
    const taskId = await startTask(current, alice);
    expect((await send(current, alice, { method: "tasks/update", params: { taskId, inputResponses: {} } })).result).toMatchObject({ resultType: "complete" });
    expect((await send(current, bob, { method: "tasks/update", params: { taskId, inputResponses: {} } })).error).toMatchObject(NOT_FOUND);
  });

  it("finds no task of another account, no unknown id and no task whose job is gone", async () => {
    const { current, alice, bob } = await setUp();
    const taskId = await startTask(current, alice);

    expect((await getTask(current, bob, taskId)).error).toMatchObject(NOT_FOUND);
    expect((await send(current, bob, { method: "tasks/cancel", params: { taskId } })).error).toMatchObject(NOT_FOUND);
    expect((await getTask(current, alice, "x".repeat(43))).error).toMatchObject(NOT_FOUND);
    expect((await getJob(current.ctx, await findJobId(current, taskId)))?.status).toBe("pending");

    await current.ctx.db.delete(jobsTable).where(eq(jobsTable.id, BigInt(await findJobId(current, taskId))));
    expect((await getTask(current, alice, taskId)).error).toMatchObject(NOT_FOUND);
  });

  it("answers an expired task as expired, and prune deletes it", async () => {
    const { current, alice } = await setUp();
    const taskId = await startTask(current, alice);
    current.clock.advance(DAY_MS);

    expect((await getTask(current, alice, taskId)).error).toEqual({ code: -32602, message: "Failed to retrieve task: Task has expired" });
    expect(await pruneMcpAccess(current.ctx)).toMatchObject({ operationTasks: 1 });
    expect((await getTask(current, alice, taskId)).error).toMatchObject(NOT_FOUND);
  });

  it("refuses tasks/get to a client that did not declare the extension on that request", async () => {
    const { current, alice } = await setUp();
    const taskId = await startTask(current, alice);

    const answer = await getTask(current, alice, taskId, { tasks: false });
    expect(answer.status).toBe(400);
    expect(answer.error).toMatchObject({ code: -32021, data: { requiredCapabilities: { extensions: { [TASKS]: {} } } } });
  });

  it("refuses a task lifetime outside a minute to thirty days as a bug in the caller", async () => {
    const { current, alice } = await setUp();
    const request = { mcpReq: { envelope: { "io.modelcontextprotocol/clientCapabilities": { extensions: { [TASKS]: {} } } } } };
    for (const taskTtlSeconds of [59, 2_592_001, 1.5]) {
      await expect(startOperation(current.ctx, alice, { queue: QUEUE, payload: { videoId: "v1" }, taskRequest: request, taskTtlSeconds })).rejects.toThrow(
        "must be whole seconds from 60 to 2592000",
      );
    }
    const custom = await startOperation(current.ctx, alice, { queue: QUEUE, payload: { videoId: "v1" }, taskRequest: request, taskTtlSeconds: 3600 });
    expect(custom).toMatchObject({ resultType: "task", ttlMs: 3_600_000 });
  });

  it("deletes the account's tasks with its data", async () => {
    const { current, alice, bob } = await setUp();
    await startTask(current, alice);
    await startTask(current, bob);

    await deleteMcpAccessUserData({ db: current.ctx.db, clock: current.clock, config: current.config }, alice.userId);
    const rows = await current.database.client.query<{ user_id: string }>("SELECT user_id::text FROM mcp.operation_tasks");
    expect(rows.rows).toEqual([{ user_id: bob.userId }]);
  });
});
