// Long operations as MCP tools (#952), on top of `@softure-ai/jobs`. A tool whose work takes minutes cannot hold the
// call open (JSON mode drops mid-call notifications, proxies cut long responses, assistants time out), so it starts a
// job and answers an operation id at once; the assistant then asks `get_operation` until the operation ends, and may
// stop it with `cancel_operation`.
//
//   server.registerTool("render_video", { inputSchema }, (args) => startOperation(ctx, identity, { queue: "video.render", payload: args }));
//   registerOperationStatusTool(server, { ctx, identity, readResult: (job) => findRenderUrl(job.id) });
//   registerOperationCancelTool(server, { ctx, identity });
//
// Ownership rides on the job itself: its origin is `mcp` and its dedup key `mcp:<userId>:<key>`, which the jobs table
// keeps after the job ends. Any other job, or another account's, is "not found".
import { randomUUID } from "node:crypto";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { enqueueJob, requestJobCancel, type JobsContext } from "@softure-ai/jobs/server";
import { z } from "zod";
import type { McpServerIdentity } from "../contract.js";
import type { McpAccessMessages } from "../messages/index.js";
import { getMcpAccessMessages } from "../server/options.js";
import { toolResult, withToolErrors, type ToolErrorHints } from "../server/tools.js";
import { answerOperationTask, isTasksRequest, isTaskTtlValid, MAX_TASK_TTL_SECONDS, type OperationTaskRequest } from "./operation-tasks.js";
import {
  describeOperation,
  fillToolName,
  findOwnedJob,
  getOwnerPrefix,
  getPollMin,
  MAX_OPERATION_DEDUP_KEY_LENGTH,
  OPERATION_ORIGIN,
  OPERATION_STATUS_TOOL_NAME,
  OPERATION_CANCEL_TOOL_NAME,
  type GetOperationOptions,
  type OperationAnswer,
  type OperationErrorCode,
  type OperationPollOptions,
  type ReadOperationResult,
} from "./operation-state.js";

export {
  getOperationStatus,
  getPollAfterSeconds,
  MAX_OPERATION_DEDUP_KEY_LENGTH,
  OPERATION_CANCEL_TOOL_NAME,
  OPERATION_ORIGIN,
  OPERATION_STATUS_TOOL_NAME,
  OPERATION_STATUSES,
  type GetOperationOptions,
  type OperationAnswer,
  type OperationErrorCode,
  type OperationJob,
  type OperationPollOptions,
  type OperationStatus,
  type ReadOperationResult,
} from "./operation-state.js";

export interface StartOperationInput {
  /** A queue defined in `jobs({ queues })`. */
  readonly queue: string;
  /** The handler's payload, as `enqueueJob` takes it: ids, not personal data. */
  readonly payload: unknown;
  /**
   * While an operation of this account and queue with the same key runs, starting again joins it (the answer carries
   * its id and status). At most 150 characters. Default: a new operation every time.
   */
  readonly dedupKey?: string;
  /** The status tool the answer tells the assistant to call. Default `get_operation`. */
  readonly statusToolName?: string;
  readonly poll?: OperationPollOptions;
  /**
   * The tool handler's request context (its second argument). When the client declared the MCP Tasks extension on
   * this request, the answer is a task (`resultType: "task"`) instead of an operation id; any other client gets the
   * operation id as before. Pair it with `registerOperationTasks` on the same server, which serves `tasks/get`.
   */
  readonly taskRequest?: OperationTaskRequest;
  /** How long a task can be read after it was created, in seconds. Default 86 400 (a day). */
  readonly taskTtlSeconds?: number;
}

interface OperationToolOptions {
  /** `{ db, clock, config }` of the request. */
  readonly ctx: JobsContext;
  /** The request's identity: operations are scoped to `identity.userId`. */
  readonly identity: McpServerIdentity;
  /** Default: the module dictionary's description. */
  readonly description?: string;
}

export interface OperationStatusToolOptions extends OperationToolOptions {
  /** Default `get_operation`. */
  readonly name?: string;
  readonly readResult?: ReadOperationResult;
  readonly poll?: OperationPollOptions;
}

export interface OperationCancelToolOptions extends OperationToolOptions {
  /** Default `cancel_operation`. */
  readonly name?: string;
  /** The status tool the answer points to. Default `get_operation`. */
  readonly statusToolName?: string;
  readonly poll?: OperationPollOptions;
}

const operationInput = z.object({ operationId: z.string().min(1).max(100) });

/**
 * For a tool handler: enqueues the operation's job and answers its id with the fixed sentence (ask the status tool,
 * do not start again). Throws on an unknown queue or a dedup key over 150 characters (a bug in the caller); database
 * failures propagate, so call it inside `withToolErrors` or let the SDK answer the error.
 */
export async function startOperation(ctx: JobsContext, identity: McpServerIdentity, input: StartOperationInput): Promise<CallToolResult> {
  if (input.dedupKey !== undefined && (input.dedupKey.length === 0 || input.dedupKey.length > MAX_OPERATION_DEDUP_KEY_LENGTH)) {
    throw new Error(`startOperation: the dedup key of queue ${input.queue} must have 1 to ${String(MAX_OPERATION_DEDUP_KEY_LENGTH)} characters`);
  }
  if (input.taskTtlSeconds !== undefined && !isTaskTtlValid(input.taskTtlSeconds)) {
    throw new Error(`startOperation: the task lifetime of queue ${input.queue} must be whole seconds from 60 to ${String(MAX_TASK_TTL_SECONDS)}`);
  }
  const enqueued = await enqueueJob(ctx, {
    queue: input.queue,
    payload: input.payload,
    origin: OPERATION_ORIGIN,
    dedupKey: getOwnerPrefix(identity.userId) + (input.dedupKey ?? randomUUID()),
  });
  const options = { ...(input.poll === undefined ? {} : { poll: input.poll }), statusToolName: input.statusToolName ?? OPERATION_STATUS_TOOL_NAME };
  if (input.taskRequest !== undefined && isTasksRequest(input.taskRequest)) {
    return answerOperationTask(ctx, identity, { jobId: enqueued.id, ...(input.taskTtlSeconds === undefined ? {} : { ttlSeconds: input.taskTtlSeconds }), ...(input.poll === undefined ? {} : { poll: input.poll }) });
  }
  if (enqueued.isDuplicate) {
    const joined = await getOperation(ctx, identity, enqueued.id, options);
    if (joined.ok) return toolResult(joined.value);
  }
  const messages = getMcpAccessMessages(ctx.config).operations;
  const answer: OperationAnswer = {
    operationId: enqueued.id,
    status: "queued",
    progress: null,
    pollAfterSeconds: getPollMin(input.poll),
    message: fillToolName(messages.started, options.statusToolName),
  };
  return toolResult(answer);
}

/** The caller's operation as `get_operation` answers it; `mcp-access.operation_not_found` for any other id. */
export async function getOperation(
  ctx: JobsContext,
  identity: McpServerIdentity,
  operationId: string,
  options: GetOperationOptions = {},
): Promise<Ok<OperationAnswer> | Err<"mcp-access.operation_not_found">> {
  const job = await findOwnedJob(ctx, identity, operationId);
  if (job === null) return err("mcp-access.operation_not_found");
  return ok(await describeOperation(ctx, job, options));
}

/**
 * Cancels the caller's operation: a queued one ends at once, a running one is asked to stop (its handler's `signal`
 * aborts on the next heartbeat). `mcp-access.operation_finished` once it has ended.
 */
export async function cancelOperation(
  ctx: JobsContext,
  identity: McpServerIdentity,
  operationId: string,
  options: Omit<GetOperationOptions, "readResult"> = {},
): Promise<Ok<OperationAnswer> | Err<OperationErrorCode>> {
  const owned = await findOwnedJob(ctx, identity, operationId);
  if (owned === null) return err("mcp-access.operation_not_found");
  const cancelled = await requestJobCancel(ctx, owned.id);
  if (!cancelled.ok) return err(cancelled.error === "jobs.not_found" ? "mcp-access.operation_not_found" : "mcp-access.operation_finished");
  return ok(await describeOperation(ctx, cancelled.value, options));
}

/** Registers the read-only status tool (`get_operation`) for the request's account. */
export function registerOperationStatusTool(server: McpServer, options: OperationStatusToolOptions): void {
  const name = options.name ?? OPERATION_STATUS_TOOL_NAME;
  const messages = getMcpAccessMessages(options.ctx.config).operations;
  const getOptions: GetOperationOptions = {
    statusToolName: name,
    ...(options.readResult === undefined ? {} : { readResult: options.readResult }),
    ...(options.poll === undefined ? {} : { poll: options.poll }),
  };
  server.registerTool(
    name,
    {
      description: options.description ?? messages.statusToolDescription,
      inputSchema: operationInput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ operationId }) =>
      withToolErrors(() => getOperation(options.ctx, options.identity, operationId, getOptions), { hints: getOperationHints(messages), label: name }),
  );
}

/** Registers the cancel tool (`cancel_operation`), a write: nothing is registered without `identity.canWrite`. */
export function registerOperationCancelTool(server: McpServer, options: OperationCancelToolOptions): void {
  if (!options.identity.canWrite) return;
  const name = options.name ?? OPERATION_CANCEL_TOOL_NAME;
  const messages = getMcpAccessMessages(options.ctx.config).operations;
  const cancelOptions = { statusToolName: options.statusToolName ?? OPERATION_STATUS_TOOL_NAME, ...(options.poll === undefined ? {} : { poll: options.poll }) };
  server.registerTool(
    name,
    {
      description: options.description ?? messages.cancelToolDescription,
      inputSchema: operationInput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ operationId }) =>
      withToolErrors(() => cancelOperation(options.ctx, options.identity, operationId, cancelOptions), { hints: getOperationHints(messages), label: name }),
  );
}


function getOperationHints(messages: McpAccessMessages["operations"]): ToolErrorHints {
  return { "mcp-access.operation_not_found": messages.notFound, "mcp-access.operation_finished": messages.finished };
}
