// The processed-item ledger of a polled source: source + item id → outcome, attempts, first and last sighting. One
// transaction takes the item's row (an upsert that also locks it, so two workers on one item take turns), runs the
// caller's callback in a savepoint and records the outcome, so the caller's writes and the ledger commit together.
import type { ErrorCode } from "@softure-ai/core";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { syncItems, type SyncItemRow } from "../schema.js";
import type { SyncItem, SyncItemFailure, SyncItemOutcome, SyncItemRunResult, SyncItemStatus } from "../sync.js";
import type { JobsContext } from "./context.js";
import { getJobsOptions } from "./options.js";
import { checkSyncSource } from "./sync-cursors.js";

const SYNC_ITEM_THREW = "jobs.sync_item_threw";
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_ITEM_ID_LENGTH = 500;
const MAX_RESULT_REF_LENGTH = 500;
const MAX_ERROR_LENGTH = 200;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows deleted per statement, so pruning a large ledger never holds one long lock. */
const PRUNE_BATCH = 1000;

export interface ProcessSyncItemInput {
  readonly source: string;
  /** The item's id at the source. */
  readonly itemId: string;
  /** Runs of the callback before the item is `failed` for good; the first run counts. Default 5. */
  readonly maxAttempts?: number;
}

/** What the callback receives: the module context with the item's transaction as `db`, and this attempt's number. */
export interface SyncItemContext extends JobsContext {
  /** Starts at 1. */
  readonly attempt: number;
}

export interface ListSyncItemsInput {
  readonly source?: string;
  readonly status?: SyncItemStatus;
  /** Only items whose status, attempts or error changed at or after this time. */
  readonly since?: Date;
  /** Default 100, at most 1000. */
  readonly limit?: number;
}

/** Thrown inside the savepoint to roll back the callback's writes when it returned a failure. */
class RunFailed extends Error {
  constructor(readonly result: SyncItemRunResult) {
    super("sync item callback failed");
  }
}

type Settled = { readonly outcome: SyncItemOutcome; readonly thrown?: undefined } | { readonly outcome?: undefined; readonly thrown: unknown };

/**
 * Handles one item of a polled source at most once. Runs `run` unless the ledger already has the item `done`,
 * `skipped` or `failed` (then `skipped`, the callback untouched). `run` gets the item's transaction as `context.db`:
 * write the item's effect through it and it commits together with the ledger's `done`. A returned failure rolls those
 * writes back, counts the attempt and leaves the item `pending` for the next run, or `failed` once `maxAttempts` runs
 * failed (or at once with `failSyncItem`). A throw is recorded the same way with `jobs.sync_item_threw` and then
 * rethrown. A call outside the database (an API) is not rolled back: a crash between it and the commit repeats it on
 * the next run, so keep it idempotent where the source allows. Throws on invalid input; database failures propagate.
 */
export async function processSyncItem(
  ctx: JobsContext,
  input: ProcessSyncItemInput,
  run: (context: SyncItemContext) => Promise<SyncItemRunResult>,
): Promise<SyncItemOutcome> {
  checkSyncSource(input.source);
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  checkItemInput(input.itemId, maxAttempts);
  const now = ctx.clock.now();

  const settled = await ctx.db.transaction(async (tx): Promise<Settled> => {
    const [seen] = await tx
      .insert(syncItems)
      .values({ source: input.source, itemId: input.itemId, status: "pending", attempts: 0, firstSeenAt: now, lastSeenAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [syncItems.source, syncItems.itemId],
        set: { lastSeenAt: sql`greatest(${syncItems.lastSeenAt}, excluded.last_seen_at)` },
      })
      .returning();
    const row = requireRow(seen);
    const where = and(eq(syncItems.source, input.source), eq(syncItems.itemId, input.itemId));
    const finish = async (values: Partial<SyncItemRow>): Promise<SyncItem> => {
      const [updated] = await tx.update(syncItems).set({ ...values, updatedAt: now }).where(where).returning();
      return toSyncItem(requireRow(updated));
    };

    if (row.status !== "pending") return { outcome: { kind: "skipped", item: toSyncItem(row) } };
    if (row.attempts >= maxAttempts) {
      // maxAttempts was lowered below what the item already used: it has had its runs.
      const error = row.errorCode ?? SYNC_ITEM_THREW;
      return { outcome: { kind: "failed", error, item: await finish({ status: "failed", errorCode: error, finishedAt: now }) } };
    }

    const attempt = row.attempts + 1;
    let result: SyncItemRunResult;
    let thrown: { readonly error: unknown } | null = null;
    try {
      result = await tx.transaction(async (savepoint) => {
        const returned = await run({ ...ctx, db: savepoint, attempt });
        if (!isOk(returned)) throw new RunFailed(returned);
        checkResultRef(returned);
        return returned;
      });
    } catch (error) {
      if (error instanceof RunFailed) {
        result = error.result;
      } else {
        thrown = { error };
        result = { ok: false, error: SYNC_ITEM_THREW };
      }
    }

    const outcome = await record(result, { attempt, maxAttempts, now, finish });
    return thrown === null ? { outcome } : { thrown: thrown.error };
  });

  if (settled.outcome === undefined) throw settled.thrown;
  return settled.outcome;
}

async function record(
  result: SyncItemRunResult,
  context: { attempt: number; maxAttempts: number; now: Date; finish: (values: Partial<SyncItemRow>) => Promise<SyncItem> },
): Promise<SyncItemOutcome> {
  const { attempt, now, finish } = context;
  if (isOk(result)) {
    const completion = result.value ?? { status: "done" };
    const item =
      completion.status === "done"
        ? await finish({ status: "done", attempts: attempt, errorCode: null, resultRef: completion.resultRef ?? null, finishedAt: now })
        : await finish({ status: "skipped", attempts: attempt, errorCode: completion.reason === undefined ? null : toErrorCode(completion.reason), finishedAt: now });
    return { kind: "handled", item };
  }
  // A callback that returned neither ok() nor an error (a JavaScript caller) counts as a throw.
  const failure = result as Partial<SyncItemFailure> | null | undefined;
  const error = toErrorCode(typeof failure?.error === "string" ? failure.error : SYNC_ITEM_THREW);
  if (failure?.retry === false || attempt >= context.maxAttempts) {
    return { kind: "failed", error, item: await finish({ status: "failed", attempts: attempt, errorCode: error, finishedAt: now }) };
  }
  return { kind: "retrying", error, item: await finish({ attempts: attempt, errorCode: error }) };
}

/**
 * The ledger, most recently changed first: for an overview page or an MCP tool. Throws on an invalid filter.
 */
export async function listSyncItems(ctx: JobsContext, input: ListSyncItemsInput = {}): Promise<SyncItem[]> {
  const limit = input.limit ?? DEFAULT_LIST_LIMIT;
  if (!(Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIST_LIMIT)) {
    throw new RangeError(`@softure-ai/jobs: listSyncItems limit must be an integer from 1 to ${String(MAX_LIST_LIMIT)}`);
  }
  if (input.source !== undefined) checkSyncSource(input.source);
  if (input.since !== undefined && Number.isNaN(input.since.getTime())) {
    throw new RangeError("@softure-ai/jobs: listSyncItems since is an invalid date");
  }
  const filters: SQL[] = [];
  if (input.source !== undefined) filters.push(eq(syncItems.source, input.source));
  if (input.status !== undefined) filters.push(eq(syncItems.status, input.status));
  if (input.since !== undefined) filters.push(gte(syncItems.updatedAt, input.since));
  const rows = await ctx.db
    .select()
    .from(syncItems)
    .where(and(...filters))
    .orderBy(desc(syncItems.updatedAt), syncItems.source, syncItems.itemId)
    .limit(limit);
  return rows.map(toSyncItem);
}

/**
 * Deletes ledger items that no `processSyncItem` call met for `retention.syncItemsDays`, in batches, whatever their
 * status: the source no longer returns them. Returns the number deleted. The worker calls it once an hour with
 * `pruneJobs`; an app without a worker calls it from the same cron.
 */
export async function pruneSyncItems(ctx: JobsContext): Promise<number> {
  const { retention } = getJobsOptions(ctx.config);
  const before = new Date(ctx.clock.now().getTime() - retention.syncItemsDays * DAY_MS);
  let deleted = 0;
  for (;;) {
    const batch = ctx.db.select({ source: syncItems.source, itemId: syncItems.itemId }).from(syncItems).where(lt(syncItems.lastSeenAt, before)).limit(PRUNE_BATCH);
    const rows = await ctx.db
      .delete(syncItems)
      .where(sql`(${syncItems.source}, ${syncItems.itemId}) in (${batch})`)
      .returning({ source: syncItems.source });
    deleted += rows.length;
    if (rows.length < PRUNE_BATCH) return deleted;
  }
}

export function toSyncItem(row: SyncItemRow): SyncItem {
  return {
    source: row.source,
    itemId: row.itemId,
    status: row.status,
    errorCode: row.errorCode,
    attempts: row.attempts,
    resultRef: row.resultRef,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
  };
}

function checkItemInput(itemId: string, maxAttempts: number): void {
  if (itemId.length === 0 || itemId.length > MAX_ITEM_ID_LENGTH) {
    throw new RangeError(`@softure-ai/jobs: a sync item id must have 1 to ${String(MAX_ITEM_ID_LENGTH)} characters`);
  }
  if (!(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 1000)) {
    throw new RangeError("@softure-ai/jobs: processSyncItem maxAttempts must be an integer from 1 to 1000");
  }
}

/** Inside the savepoint, so a bad reference counts as a thrown attempt and rolls the callback's writes back. */
function checkResultRef(result: SyncItemRunResult): void {
  const completion = result.ok ? result.value : undefined;
  if (completion?.status !== "done" || completion.resultRef === undefined) return;
  if (completion.resultRef.length === 0 || completion.resultRef.length > MAX_RESULT_REF_LENGTH) {
    throw new RangeError(`@softure-ai/jobs: a sync item resultRef must have 1 to ${String(MAX_RESULT_REF_LENGTH)} characters`);
  }
}

function isOk(result: unknown): result is SyncItemRunResult & { ok: true } {
  return typeof result === "object" && result !== null && (result as { ok?: unknown }).ok === true;
}

function toErrorCode(error: string): ErrorCode {
  const trimmed = error.slice(0, MAX_ERROR_LENGTH);
  return (trimmed.includes(".") ? trimmed : SYNC_ITEM_THREW) as ErrorCode;
}

function requireRow<T>(row: T | undefined): T {
  if (row === undefined) throw new Error("@softure-ai/jobs: a sync item write returned no row");
  return row;
}
