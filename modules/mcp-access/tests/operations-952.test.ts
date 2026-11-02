// Long operations as MCP tools (#952): `startOperation` answers an id at once, `get_operation` follows the job with
// its progress and a growing wait, `cancel_operation` stops it; every one is scoped to the caller's account.
import { createMcpHandler, McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { failJob, defineJobHandler, jobs, jobsTable, type JobHandlers } from "@softure-ai/jobs";
import { claimJobs, enqueueJob, getJob } from "@softure-ai/jobs/server";
import { runDueJobs } from "@softure-ai/jobs/testing";
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import {
  getOperationStatus,
  getPollAfterSeconds,
  registerOperationCancelTool,
  registerOperationStatusTool,
  startOperation,
  type OperationAnswer,
  type ReadOperationResult,
} from "@softure-ai/mcp-access/jobs";
import { ok } from "@softure-ai/core";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig, createTestMcp, OPTIONS, type TestMcp } from "./support.js";

const ALICE: McpServerIdentity = { userId: "00000000-0000-4000-8000-00000000000a", canWrite: true, tokenId: "token-a" };
const BOB: McpServerIdentity = { userId: "00000000-0000-4000-8000-00000000000b", canWrite: true, tokenId: "token-b" };
const QUEUE = "video.render";
const STARTED =
  "The operation has started and runs in the background. Call get_operation with this operationId after pollAfterSeconds to follow it. Do not call the starting tool again.";

function readAnswer(result: CallToolResult): OperationAnswer {
  const [content] = result.content;
  if (content?.type !== "text") throw new Error("the tool answered no text");
  return JSON.parse(content.text) as OperationAnswer;
}

function readText(result: CallToolResult): string {
  const [content] = result.content;
  if (content?.type !== "text") throw new Error("the tool answered no text");
  return content.text;
}

const handlers = {
  [QUEUE]: defineJobHandler({
    payload: z.object({ videoId: z.string(), fail: z.boolean().optional() }),
    run: (payload) => Promise.resolve(payload.fail === true ? failJob("video.encode_failed") : ok()),
  }),
} satisfies JobHandlers;

describe("long operations as MCP tools", () => {
  let test: TestMcp | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  async function setUp(): Promise<TestMcp> {
    test = await createTestMcp(createConfig(OPTIONS, "en", [jobs({ queues: { [QUEUE]: { maxAttempts: 3 } } })]));
    return test;
  }

  /** Calls a tool the way a client does, through the SDK in JSON mode. */
  async function callTool(
    current: TestMcp,
    identity: McpServerIdentity,
    name: string,
    args: Record<string, unknown>,
    readResult?: ReadOperationResult,
  ): Promise<CallToolResult> {
    const handler = createMcpHandler(
      () => {
        const server = new McpServer({ name: "acme", version: "1.0.0" });
        server.registerTool("render_video", { inputSchema: z.object({ videoId: z.string() }) }, (input) =>
          startOperation(current.ctx, identity, { queue: QUEUE, payload: input, dedupKey: `video:${input.videoId}` }),
        );
        registerOperationStatusTool(server, { ctx: current.ctx, identity, ...(readResult === undefined ? {} : { readResult }) });
        registerOperationCancelTool(server, { ctx: current.ctx, identity });
        return server;
      },
      { responseMode: "json" },
    );
    const response = await handler.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      }),
    );
    const text = await response.text();
    const data = text.startsWith("event:") ? (text.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : text;
    const body = JSON.parse(data) as { result?: CallToolResult; error?: { message: string } };
    if (body.result === undefined) throw new Error(`tools/call failed: ${body.error?.message ?? "no answer"}`);
    return body.result;
  }

  async function start(current: TestMcp, identity: McpServerIdentity = ALICE, payload: unknown = { videoId: "v1" }, dedupKey?: string): Promise<OperationAnswer> {
    return readAnswer(await startOperation(current.ctx, identity, { queue: QUEUE, payload, ...(dedupKey === undefined ? {} : { dedupKey }) }));
  }

  async function claim(current: TestMcp): Promise<void> {
    await claimJobs(current.ctx, { queue: QUEUE, limit: 10, workerId: "worker-1" });
  }

  async function setJob(current: TestMcp, id: string, values: Partial<typeof jobsTable.$inferInsert>): Promise<void> {
    await current.ctx.db.update(jobsTable).set(values).where(eq(jobsTable.id, BigInt(id)));
  }

  it("starts an operation: a job of origin mcp, owned by the caller, answered as queued with the fixed sentence", async () => {
    const current = await setUp();
    const answer = readAnswer(await callTool(current, ALICE, "render_video", { videoId: "v1" }));

    expect(answer).toEqual({ operationId: expect.any(String) as string, status: "queued", progress: null, pollAfterSeconds: 2, message: STARTED });
    const job = await getJob(current.ctx, answer.operationId);
    expect(job).toMatchObject({ queue: QUEUE, origin: "mcp", payload: { videoId: "v1" }, dedupKey: `mcp:${ALICE.userId}:video:v1` });
  });

  it("joins a running operation with the same key, but never another account's", async () => {
    const current = await setUp();
    const first = await start(current, ALICE, { videoId: "v1" }, "video:v1");
    await claim(current);

    const again = await start(current, ALICE, { videoId: "v1" }, "video:v1");
    const bobs = await start(current, BOB, { videoId: "v1" }, "video:v1");

    expect(again.operationId).toBe(first.operationId);
    expect(again.status).toBe("running");
    expect(bobs.operationId).not.toBe(first.operationId);
    expect(bobs.status).toBe("queued");
  });

  it("starts a new operation every time without a dedup key", async () => {
    const current = await setUp();
    const first = await start(current);
    const second = await start(current);
    expect(second.operationId).not.toBe(first.operationId);
  });

  it("refuses an empty or too long dedup key as a bug in the caller", async () => {
    const current = await setUp();
    await expect(start(current, ALICE, {}, "")).rejects.toThrow("must have 1 to 150 characters");
    await expect(start(current, ALICE, {}, "k".repeat(151))).rejects.toThrow("must have 1 to 150 characters");
  });

  it("answers a running operation with its progress and a wait that grows with its age", async () => {
    const current = await setUp();
    const { operationId } = await start(current);
    await claim(current);
    await setJob(current, operationId, { progress: { step: "render.encode", done: 3, total: 10 }, progressAt: current.clock.now() });
    current.clock.advance(60_000);

    expect(readAnswer(await callTool(current, ALICE, "get_operation", { operationId }))).toEqual({
      operationId,
      status: "running",
      progress: { step: "render.encode", done: 3, total: 10 },
      pollAfterSeconds: 15,
      message: "The operation is running. Call get_operation again after pollAfterSeconds.",
    });
  });

  it("answers a succeeded operation with the app's result and no wait", async () => {
    const current = await setUp();
    const { operationId } = await start(current);
    expect(await runDueJobs(current.ctx, { handlers })).toMatchObject({ succeeded: 1 });

    const answer = readAnswer(await callTool(current, ALICE, "get_operation", { operationId }, (job) => ({ url: `https://cdn.example.com/${job.id}.mp4` })));
    expect(answer).toEqual({
      operationId,
      status: "succeeded",
      progress: null,
      result: { url: `https://cdn.example.com/${operationId}.mp4` },
      message: "The operation has finished.",
    });
  });

  it("answers a succeeded operation without a result when the app reads none", async () => {
    const current = await setUp();
    const { operationId } = await start(current);
    await runDueJobs(current.ctx, { handlers });
    expect(readAnswer(await callTool(current, ALICE, "get_operation", { operationId }))).toEqual({
      operationId,
      status: "succeeded",
      progress: null,
      message: "The operation has finished.",
    });
  });

  it("answers a failed operation with its error code", async () => {
    const current = await setUp();
    const { operationId } = await start(current, ALICE, { videoId: "v1", fail: true });
    expect(await runDueJobs(current.ctx, { handlers })).toMatchObject({ failed: 1 });

    expect(readAnswer(await callTool(current, ALICE, "get_operation", { operationId }))).toEqual({
      operationId,
      status: "failed",
      progress: null,
      errorCode: "video.encode_failed",
      message: "The operation failed. Tell the user; start it again only if they ask.",
    });
  });

  it("answers an operation waiting for a retry as running", async () => {
    const current = await setUp();
    const { operationId } = await start(current);
    await setJob(current, operationId, { status: "pending", attempts: 1, lastError: "video.encode_failed" });
    expect(readAnswer(await callTool(current, ALICE, "get_operation", { operationId })).status).toBe("running");
  });

  it("finds no operation of another account, no job that is not an operation and no malformed id", async () => {
    const current = await setUp();
    const { operationId } = await start(current);
    const plain = await enqueueJob(current.ctx, { queue: QUEUE, payload: { videoId: "v2" }, dedupKey: `mcp:${ALICE.userId}:x` });
    const notFound = "No operation with this id belongs to this account.";

    for (const id of [plain.id, "not-a-number", "999999"]) {
      const result = await callTool(current, ALICE, "get_operation", { operationId: id });
      expect(result.isError).toBe(true);
      expect(readText(result)).toBe(notFound);
    }
    const bobs = await callTool(current, BOB, "get_operation", { operationId });
    expect([bobs.isError, readText(bobs)]).toEqual([true, notFound]);
    const bobsCancel = await callTool(current, BOB, "cancel_operation", { operationId });
    expect([bobsCancel.isError, readText(bobsCancel)]).toEqual([true, notFound]);
    expect((await getJob(current.ctx, operationId))?.status).toBe("pending");
  });

  it("cancels a queued operation at once", async () => {
    const current = await setUp();
    const { operationId } = await start(current);

    expect(readAnswer(await callTool(current, ALICE, "cancel_operation", { operationId }))).toEqual({
      operationId,
      status: "cancelled",
      progress: null,
      errorCode: "jobs.cancelled",
      message: "The operation was cancelled.",
    });
    expect((await getJob(current.ctx, operationId))?.status).toBe("cancelled");
  });

  it("asks a running operation to stop and says so until it ends", async () => {
    const current = await setUp();
    const { operationId } = await start(current);
    await claim(current);

    const expected = {
      operationId,
      status: "running",
      progress: null,
      pollAfterSeconds: 2,
      cancelRequested: true,
      message: "The operation was asked to stop and will end shortly. Call get_operation again after pollAfterSeconds.",
    };
    expect(readAnswer(await callTool(current, ALICE, "cancel_operation", { operationId }))).toEqual(expected);
    expect(readAnswer(await callTool(current, ALICE, "get_operation", { operationId }))).toEqual(expected);
  });

  it("refuses to cancel an operation that has ended", async () => {
    const current = await setUp();
    const { operationId } = await start(current);
    await runDueJobs(current.ctx, { handlers });

    const result = await callTool(current, ALICE, "cancel_operation", { operationId });
    expect([result.isError, readText(result)]).toEqual([true, "The operation has already ended, so it cannot be cancelled."]);
  });

  it("registers the cancel tool only for an identity that may write", async () => {
    const current = await setUp();
    const listed = (identity: McpServerIdentity): string[] => {
      const server = new McpServer({ name: "acme", version: "1.0.0" });
      registerOperationStatusTool(server, { ctx: current.ctx, identity });
      registerOperationCancelTool(server, { ctx: current.ctx, identity });
      return Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
    };
    expect(listed({ ...ALICE, canWrite: false })).toEqual(["get_operation"]);
    expect(listed(ALICE)).toEqual(["get_operation", "cancel_operation"]);
  });

  it("maps every job status to an operation status", () => {
    expect(getOperationStatus({ status: "pending", attempts: 0 })).toBe("queued");
    expect(getOperationStatus({ status: "pending", attempts: 2 })).toBe("running");
    expect(getOperationStatus({ status: "running", attempts: 1 })).toBe("running");
    expect(getOperationStatus({ status: "succeeded", attempts: 1 })).toBe("succeeded");
    expect(getOperationStatus({ status: "failed", attempts: 3 })).toBe("failed");
    expect(getOperationStatus({ status: "cancelled", attempts: 0 })).toBe("cancelled");
  });

  it("grows the wait with the age, between its bounds", () => {
    expect(getPollAfterSeconds(0)).toBe(2);
    expect(getPollAfterSeconds(-5)).toBe(2);
    expect(getPollAfterSeconds(20)).toBe(5);
    expect(getPollAfterSeconds(119)).toBe(30);
    expect(getPollAfterSeconds(3600)).toBe(30);
    expect(getPollAfterSeconds(3600, { minSeconds: 5, maxSeconds: 60 })).toBe(60);
    expect(getPollAfterSeconds(0, { minSeconds: 5, maxSeconds: 60 })).toBe(5);
  });
});
