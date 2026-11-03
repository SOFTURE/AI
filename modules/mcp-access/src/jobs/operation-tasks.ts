// Long operations as MCP Tasks (#977): the Tasks extension `io.modelcontextprotocol/tasks` of protocol revision
// 2026-07-28. A client that declares the extension on a tool call gets a task instead of an operation id and follows it
// through `tasks/get`; every other client keeps the polling tools (`get_operation`, `cancel_operation`) of #952.
//
//   registerOperationTasks(server, { ctx, identity, readResult: (job) => findRenderUrl(job.id) });
//   server.registerTool("render_video", { inputSchema }, (args, request) =>
//     startOperation(ctx, identity, { queue: "video.render", payload: args, taskRequest: request }));
//
// A task id is random (the spec requires ids nobody can guess) and lives in `mcp.operation_tasks` with its owner, the
// operation's job and an expiry. Every task request checks the owner too, and reads the job's state as it is now.
import { randomBytes } from "node:crypto";
import {
  CLIENT_CAPABILITIES_META_KEY,
  MissingRequiredClientCapabilityError,
  ProtocolError,
  ProtocolErrorCode,
  type CallToolResult,
  type McpServer,
} from "@modelcontextprotocol/server";
import type { Job } from "@softure-ai/jobs";
import { requestJobCancel, type JobsContext } from "@softure-ai/jobs/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { McpServerIdentity } from "../contract.js";
import { operationTasks } from "../schema.js";
import { getMcpAccessMessages } from "../server/options.js";
import { toolResult } from "../server/tools.js";
import {
  describeOperation,
  findOwnedJob,
  getOperationStatus,
  getPollAfterSeconds,
  type OperationPollOptions,
  type ReadOperationResult,
} from "./operation-state.js";

/** The extension's identifier, in the client's per-request capabilities and the server's `capabilities.extensions`. */
export const TASKS_EXTENSION = "io.modelcontextprotocol/tasks";
export const DEFAULT_TASK_TTL_SECONDS = 86_400;
export const MIN_TASK_TTL_SECONDS = 60;
/** Thirty days: a task outlives its operation only so long. */
export const MAX_TASK_TTL_SECONDS = 2_592_000;

const TASK_ID_BYTES = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASK_NOT_FOUND = "Failed to retrieve task: Task not found";
const TASK_EXPIRED = "Failed to retrieve task: Task has expired";
const CANCEL_NEEDS_WRITE = "Cancelling a task needs a token with write access";

/** The tool handler's request context (its second argument): only its per-request `_meta` envelope is read. */
export interface OperationTaskRequest {
  readonly mcpReq: { readonly envelope?: object };
}

/** A task's status as the extension defines it; operations never ask for input, nor fail at the protocol level. */
export type OperationTaskStatus = "working" | "completed" | "cancelled";

/** A task as `tasks/get` answers it. `result` once completed: the `get_operation` answer, `isError` when it failed. */
export interface OperationTask {
  readonly taskId: string;
  readonly status: OperationTaskStatus;
  readonly statusMessage?: string;
  /** ISO 8601. */
  readonly createdAt: string;
  /** ISO 8601: the job's last change. */
  readonly lastUpdatedAt: string;
  readonly ttlMs: number;
  /** Only while working: the operation's wait (`pollAfterSeconds`) in milliseconds. */
  readonly pollIntervalMs?: number;
  readonly result?: CallToolResult;
}

/** `ctx`, or `getContext` resolved inside each task request (see `OperationToolContext`). */
export type OperationTasksOptions = OperationTaskContext & {
  /** The request's identity: a task is found only for its owner, and only a writer may cancel it. */
  readonly identity: McpServerIdentity;
  readonly readResult?: ReadOperationResult;
  readonly poll?: OperationPollOptions;
};

type OperationTaskContext =
  | { readonly ctx: JobsContext; readonly getContext?: never }
  | { readonly ctx?: never; readonly getContext: () => Promise<JobsContext> };

export interface AnswerOperationTaskInput {
  readonly jobId: string;
  readonly ttlSeconds?: number;
  readonly poll?: OperationPollOptions;
}

type TaskRow = typeof operationTasks.$inferSelect;

const taskIdParams = z.looseObject({ taskId: z.string() });
const taskResult = z.looseObject({});
const clientCapabilities = z.looseObject({ extensions: z.record(z.string(), z.unknown()).optional() });

/** True when the request's client declared the Tasks extension in its per-request capabilities (revision 2026-07-28). */
export function isTasksRequest(request: OperationTaskRequest): boolean {
  const envelope: Partial<Record<string, unknown>> = { ...request.mcpReq.envelope };
  const capabilities = clientCapabilities.safeParse(envelope[CLIENT_CAPABILITIES_META_KEY]);
  return capabilities.success && capabilities.data.extensions?.[TASKS_EXTENSION] !== undefined;
}

export function isTaskTtlValid(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= MIN_TASK_TTL_SECONDS && seconds <= MAX_TASK_TTL_SECONDS;
}

/**
 * The tool's answer as a task (`resultType: "task"`) for the operation's job: stores the task before answering, as the
 * spec requires, and gives the same account the same task id for the same job.
 */
export async function answerOperationTask(ctx: JobsContext, identity: McpServerIdentity, input: AnswerOperationTaskInput): Promise<CallToolResult> {
  const row = await storeTask(ctx, identity, input);
  const job = await findOwnedJob(ctx, identity, input.jobId);
  if (job === null) throw new Error(`answerOperationTask: job ${input.jobId} is not an operation of this account`);
  const task = await describeTask(ctx, row, job, input.poll === undefined ? {} : { poll: input.poll });
  // On revision 2026-07-28 the SDK passes a tool's own `resultType` through; its `CallToolResult` type does not know
  // the extension's task shape, and the `content` it would add anyway is ignored by clients.
  return { content: [], ...task, resultType: "task" };
}

/** The caller's task with its operation's state now; `null` when unknown, another account's, or its job is gone. */
export async function getOperationTask(
  ctx: JobsContext,
  identity: McpServerIdentity,
  taskId: string,
  options: Pick<OperationTasksOptions, "readResult" | "poll"> = {},
): Promise<OperationTask | "expired" | null> {
  const found = await findTask(ctx, identity, taskId);
  if (found === null || found === "expired") return found;
  return describeTask(ctx, found.row, found.job, options);
}

/**
 * Serves the Tasks extension on the app's server: declares the capability and answers `tasks/get`, `tasks/update` and
 * `tasks/cancel` for the request's account. Register it on every server whose tools pass `taskRequest`.
 */
export function registerOperationTasks(server: McpServer, options: OperationTasksOptions): void {
  const { identity } = options;
  const resolveContext = (): Promise<JobsContext> => (options.getContext === undefined ? Promise.resolve(options.ctx) : options.getContext());
  const describeOptions = { ...(options.readResult === undefined ? {} : { readResult: options.readResult }), ...(options.poll === undefined ? {} : { poll: options.poll }) };
  server.server.registerCapabilities({ extensions: { [TASKS_EXTENSION]: {} } });

  server.server.setRequestHandler("tasks/get", { params: taskIdParams, result: taskResult }, async ({ taskId }, request) => {
    requireTasksCapability(request);
    return { ...(await requireTask(await resolveContext(), identity, taskId, describeOptions)) };
  });

  // Operations never ask for input, so there is nothing to update; an owned task is acknowledged, as the spec asks.
  server.server.setRequestHandler("tasks/update", { params: taskIdParams, result: taskResult }, async ({ taskId }, request) => {
    requireTasksCapability(request);
    await requireTask(await resolveContext(), identity, taskId, describeOptions);
    return {};
  });

  server.server.setRequestHandler("tasks/cancel", { params: taskIdParams, result: taskResult }, async ({ taskId }, request) => {
    requireTasksCapability(request);
    const ctx = await resolveContext();
    const found = await findTask(ctx, identity, taskId);
    if (found === null) throw new ProtocolError(ProtocolErrorCode.InvalidParams, TASK_NOT_FOUND);
    if (found === "expired") throw new ProtocolError(ProtocolErrorCode.InvalidParams, TASK_EXPIRED);
    if (!identity.canWrite) throw new ProtocolError(ProtocolErrorCode.InvalidRequest, CANCEL_NEEDS_WRITE);
    // Cancelling is cooperative: an operation that has already ended is acknowledged all the same.
    await requestJobCancel(ctx, found.job.id);
    return {};
  });
}

async function storeTask(ctx: JobsContext, identity: McpServerIdentity, input: AnswerOperationTaskInput): Promise<TaskRow> {
  const now = ctx.clock.now();
  const expiresAt = new Date(now.getTime() + (input.ttlSeconds ?? DEFAULT_TASK_TTL_SECONDS) * 1000);
  // One task per account and job: joining a running operation answers its task again, kept alive at least as long.
  const [row] = await ctx.db
    .insert(operationTasks)
    .values({ taskId: randomBytes(TASK_ID_BYTES).toString("base64url"), userId: identity.userId, jobId: BigInt(input.jobId), createdAt: now, expiresAt })
    .onConflictDoUpdate({
      target: [operationTasks.userId, operationTasks.jobId],
      set: { expiresAt: sql`greatest(${operationTasks.expiresAt}, excluded.expires_at)` },
    })
    .returning();
  if (row === undefined) throw new Error(`answerOperationTask: no task row for job ${input.jobId}`);
  return row;
}

async function findTask(ctx: JobsContext, identity: McpServerIdentity, taskId: string): Promise<{ readonly row: TaskRow; readonly job: Job } | "expired" | null> {
  if (!UUID.test(identity.userId)) return null;
  const [row] = await ctx.db
    .select()
    .from(operationTasks)
    .where(and(eq(operationTasks.taskId, taskId), eq(operationTasks.userId, identity.userId)))
    .limit(1);
  if (row === undefined) return null;
  if (row.expiresAt.getTime() <= ctx.clock.now().getTime()) return "expired";
  const job = await findOwnedJob(ctx, identity, row.jobId.toString());
  return job === null ? null : { row, job };
}

async function requireTask(
  ctx: JobsContext,
  identity: McpServerIdentity,
  taskId: string,
  options: Pick<OperationTasksOptions, "readResult" | "poll">,
): Promise<OperationTask> {
  const task = await getOperationTask(ctx, identity, taskId, options);
  if (task === null) throw new ProtocolError(ProtocolErrorCode.InvalidParams, TASK_NOT_FOUND);
  if (task === "expired") throw new ProtocolError(ProtocolErrorCode.InvalidParams, TASK_EXPIRED);
  return task;
}

/** The spec's rule for `tasks/*`: a client that did not declare the extension on this request gets `-32021`. */
function requireTasksCapability(request: OperationTaskRequest): void {
  if (!isTasksRequest(request)) throw new MissingRequiredClientCapabilityError({ requiredCapabilities: { extensions: { [TASKS_EXTENSION]: {} } } });
}

async function describeTask(ctx: JobsContext, row: TaskRow, job: Job, options: Pick<OperationTasksOptions, "readResult" | "poll">): Promise<OperationTask> {
  const messages = getMcpAccessMessages(ctx.config).operations;
  const status = getOperationStatus(job);
  const base = {
    taskId: row.taskId,
    createdAt: row.createdAt.toISOString(),
    lastUpdatedAt: job.updatedAt.toISOString(),
    ttlMs: row.expiresAt.getTime() - row.createdAt.getTime(),
  };
  if (status === "queued" || status === "running") {
    const ageSeconds = (ctx.clock.now().getTime() - job.createdAt.getTime()) / 1000;
    const statusMessage = job.cancelRequestedAt !== null ? messages.taskCancelRequested : status === "queued" ? messages.taskQueued : messages.taskRunning;
    return { ...base, status: "working", statusMessage, pollIntervalMs: getPollAfterSeconds(ageSeconds, options.poll) * 1000 };
  }
  if (status === "cancelled") return { ...base, status: "cancelled", statusMessage: messages.cancelled };
  // A failed job is a tool-level failure, not a JSON-RPC error: the spec makes it `completed` with `isError`.
  const answer = await describeOperation(ctx, job, options);
  const result = status === "failed" ? { ...toolResult(answer), isError: true } : toolResult(answer);
  return { ...base, status: "completed", statusMessage: answer.message, result };
}
