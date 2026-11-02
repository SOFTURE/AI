// The state of a long operation (#952) as both answers read it: the polling tools (`get_operation`) and MCP Tasks
// (#977). An operation is a job of origin `mcp` whose dedup key starts with `mcp:<userId>:`.
import { JOB_CANCELLED_CODE, type Job, type JobProgress } from "@softure-ai/jobs";
import { getJob, type JobsContext } from "@softure-ai/jobs/server";
import type { McpServerIdentity } from "../contract.js";
import { getMcpAccessMessages } from "../server/options.js";

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

export interface GetOperationOptions {
  readonly readResult?: ReadOperationResult;
  readonly poll?: OperationPollOptions;
  readonly statusToolName?: string;
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

export async function describeOperation(ctx: JobsContext, job: Job, options: GetOperationOptions): Promise<OperationAnswer> {
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
export async function findOwnedJob(ctx: JobsContext, identity: McpServerIdentity, operationId: string): Promise<Job | null> {
  const job = await getJob(ctx, operationId);
  if (job === null || job.origin !== OPERATION_ORIGIN || job.dedupKey?.startsWith(getOwnerPrefix(identity.userId)) !== true) return null;
  return job;
}

export function getOwnerPrefix(userId: string): string {
  return `${OPERATION_ORIGIN}:${userId}:`;
}

export function getPollMin(poll: OperationPollOptions = {}): number {
  return poll.minSeconds ?? DEFAULT_MIN_POLL_SECONDS;
}

export function fillToolName(text: string, toolName: string): string {
  return text.replaceAll("{tool}", toolName);
}
