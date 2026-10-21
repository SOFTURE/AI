// Sync state of polling integrations: the ledger's types and what a `processSyncItem` callback returns. The database
// work is in `@softure-ai/jobs/server` (`processSyncItem`, `advanceSyncCursor`, `listSyncItems`).
import type { Err, ErrorCode, Ok } from "@softure-ai/core";

export const SYNC_ITEM_STATUSES = ["pending", "done", "skipped", "failed"] as const;

/** `pending`: seen, not handled yet (a failed attempt with attempts left); `done`, `skipped`, `failed` are final. */
export type SyncItemStatus = (typeof SYNC_ITEM_STATUSES)[number];

/** One item of the processed-item ledger. */
export interface SyncItem {
  readonly source: string;
  readonly itemId: string;
  readonly status: SyncItemStatus;
  /** The code of the last failed attempt, or why the item was skipped; never a message. */
  readonly errorCode: string | null;
  /** Runs of the callback so far. */
  readonly attempts: number;
  /** What handling the item produced in the app (a task id), when the callback named it. */
  readonly resultRef: string | null;
  readonly firstSeenAt: Date;
  /** The last time `processSyncItem` met the item; pruning goes by it. */
  readonly lastSeenAt: Date;
  /** The last change of status, attempts or error code. */
  readonly updatedAt: Date;
  readonly finishedAt: Date | null;
}

/** How a callback ends an item well: handled (`ok()`, or `ok({ status: "done", resultRef })`) or deliberately skipped. */
export type SyncItemCompletion =
  | { readonly status: "done"; readonly resultRef?: string }
  | { readonly status: "skipped"; readonly reason?: ErrorCode };

/** A callback's failure: tried again on the next run unless `retry` is false or the attempts are used up. */
export type SyncItemFailure = Err<ErrorCode> & { readonly retry?: boolean };

/** What a `processSyncItem` callback returns. */
export type SyncItemRunResult = Ok<SyncItemCompletion | undefined> | SyncItemFailure;

/** What `processSyncItem` did with an item. */
export type SyncItemOutcome =
  /** The callback ran and succeeded; `item.status` is `done` or `skipped`. */
  | { readonly kind: "handled"; readonly item: SyncItem }
  /** The callback failed; the item stays `pending` and the next run tries it again. */
  | { readonly kind: "retrying"; readonly error: string; readonly item: SyncItem }
  /** The callback failed for good (attempts used up, or `failSyncItem`); the item is `failed`. */
  | { readonly kind: "failed"; readonly error: string; readonly item: SyncItem }
  /** The callback did not run: the item was already `done`, `skipped` or `failed` (see `item.status`). */
  | { readonly kind: "skipped"; readonly item: SyncItem };

/** Ends an item as `skipped` (not relevant to the app), with an optional code saying why; never tried again. */
export function skipSyncItem(reason?: ErrorCode): Ok<SyncItemCompletion> {
  return { ok: true, value: reason === undefined ? { status: "skipped" } : { status: "skipped", reason } };
}

/** A failure that is not retried: the item is `failed` at once with this code. */
export function failSyncItem<E extends ErrorCode>(error: E): SyncItemFailure {
  return { ok: false, error, retry: false };
}
