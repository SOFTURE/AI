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
import { JOB_CANCELLED_CODE, type Job, type JobProgress } from "@softure-ai/jobs";
import { enqueueJob, getJob, requestJobCancel, type JobsContext } from "@softure-ai/jobs/server";
import { z } from "zod";
import type { McpServerIdentity } from "../contract.js";
import type { McpAccessMessages } from "../messages/index.js";
import { getMcpAccessMessages } from "../server/options.js";
import { toolResult, withToolErrors, type ToolErrorHints } from "../server/tools.js";

/** The origin of every operation's job: the jobs admin page and run log show where it came from. */
export const OPERATION_ORIGIN = "mcp";
export const OPERATION_STATUS_TOOL_NAME = "get_operation";
export const OPERATION_CANCEL_TOOL_NAME = "cancel_operation";
/** The longest dedup key an app may pass: the column holds 200 characters and the owner's prefix takes 42. */
export const MAX_OPERATION_DEDUP_KEY_LENGTH = 150;

const DEFAULT_MIN_POLL_SECONDS = 2;
const DEFAULT_MAX_POLL_SECONDS = 30;
/** The wait grows with the operation's age: a quarter of the seconds since it started. */
const POLL_AGE_FACTOR = 0.25;

export const OPERATION_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;

/** An operation's status as the assistant reads it: a retrying job is `running`, since the operation has not ended. */
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export type OperationErrorCode = "mcp-access.operation_not_found" | "mcp-access.operation_finished";

/** How often the assistant is told to ask again: between `minSeconds` (default 2) and `maxSeconds` (default 30). */
export interface OperationPollOptions {
  readonly minSeconds?: number;
  readonly maxSeconds?: number;
}

/** The job behind an operation, as `readResult` receives it. */
export interface OperationJob {
  readonly id: string;
  readonly queue: string;
  readonly payload: unknown;
  readonly finishedAt: Date | null;
}

/** The app's result of a succeeded operation (a URL, an id, counts), read from its own tables; never a secret. */
export type ReadOperationResult = (job: OperationJob) => unknown;

/** What `get_operation` answers. `pollAfterSeconds` only while the operation runs, `result` and `errorCode` once ended. */
export interface OperationAnswer {
  readonly operationId: string;
  readonly status: OperationStatus;
  /** The running attempt's progress (`context.reportProgress`): codes and counts only. */
  readonly progress: JobProgress | null;
  readonly pollAfterSeconds?: number;
  /** True once someone asked a running operation to stop and it has not ended yet. */
  readonly cancelRequested?: boolean;
  readonly result?: unknown;
  /** The failure's code (`lastError`), `jobs.cancelled` for a cancelled operation. */
  readonly errorCode?: string;
  /** What the assistant should do next, in a sentence. */
  readonly message: string;
}

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

export interface GetOperationOptions {
  readonly readResult?: ReadOperationResult;
  readonly poll?: OperationPollOptions;
  readonly statusToolName?: string;
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
  const enqueued = await enqueueJob(ctx, {
    queue: input.queue,
    payload: input.payload,
    origin: OPERATION_ORIGIN,
    dedupKey: getOwnerPrefix(identity.userId) + (input.dedupKey ?? randomUUID()),
  });
  const options = { ...(input.poll === undefined ? {} : { poll: input.poll }), statusToolName: input.statusToolName ?? OPERATION_STATUS_TOOL_NAME };
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

/** The operation's status: a pending job that has used an attempt is waiting for a retry, so it is `running`. */
export function getOperationStatus(job: Pick<Job, "status" | "attempts">): OperationStatus {
  if (job.status === "pending") return job.attempts === 0 ? "queued" : "running";
  return job.status;
}

/** Seconds until the next status call: a quarter of the operation's age, clamped to the poll bounds. */
export function getPollAfterSeconds(ageSeconds: number, poll: OperationPollOptions = {}): number {
  const min = getPollMin(poll);
  const max = Math.max(min, poll.maxSeconds ?? DEFAULT_MAX_POLL_SECONDS);
  return Math.min(max, Math.max(min, Math.round(Math.max(0, ageSeconds) * POLL_AGE_FACTOR)));
}

async function describeOperation(ctx: JobsContext, job: Job, options: GetOperationOptions): Promise<OperationAnswer> {
  const messages = getMcpAccessMessages(ctx.config).operations;
  const status = getOperationStatus(job);
  const statusToolName = options.statusToolName ?? OPERATION_STATUS_TOOL_NAME;
  const base = { operationId: job.id, status, progress: status === "running" ? job.progress : null };
  if (status === "queued" || status === "running") {
    const ageSeconds = (ctx.clock.now().getTime() - job.createdAt.getTime()) / 1000;
    const cancelRequested = job.cancelRequestedAt !== null;
    return {
      ...base,
      pollAfterSeconds: getPollAfterSeconds(ageSeconds, options.poll),
      ...(cancelRequested ? { cancelRequested } : {}),
      message: fillToolName(cancelRequested ? messages.cancelRequested : messages[status], statusToolName),
    };
  }
  if (status === "succeeded") {
    const result = options.readResult === undefined ? undefined : await options.readResult({ id: job.id, queue: job.queue, payload: job.payload, finishedAt: job.finishedAt });
    return { ...base, ...(result === undefined ? {} : { result }), message: messages.succeeded };
  }
  if (status === "cancelled") return { ...base, errorCode: JOB_CANCELLED_CODE, message: messages.cancelled };
  return { ...base, ...(job.lastError === null ? {} : { errorCode: job.lastError }), message: messages.failed };
}

/** The job behind the caller's operation, or null: not a job, not an operation, or another account's. */
async function findOwnedJob(ctx: JobsContext, identity: McpServerIdentity, operationId: string): Promise<Job | null> {
  const job = await getJob(ctx, operationId);
  if (job === null || job.origin !== OPERATION_ORIGIN || job.dedupKey?.startsWith(getOwnerPrefix(identity.userId)) !== true) return null;
  return job;
}

function getOwnerPrefix(userId: string): string {
  return `${OPERATION_ORIGIN}:${userId}:`;
}

function getPollMin(poll: OperationPollOptions = {}): number {
  return poll.minSeconds ?? DEFAULT_MIN_POLL_SECONDS;
}

function fillToolName(text: string, toolName: string): string {
  return text.replaceAll("{tool}", toolName);
}

function getOperationHints(messages: McpAccessMessages["operations"]): ToolErrorHints {
  return { "mcp-access.operation_not_found": messages.notFound, "mcp-access.operation_finished": messages.finished };
}
