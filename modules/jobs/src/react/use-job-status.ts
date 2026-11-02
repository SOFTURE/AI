"use client";

// The waiting screen's side of an owned job: polls the app's status route (`createJobStatusRoute`) until the job ends.
// Polling backs off while nothing changes and after a network failure, pauses while the tab is hidden, and polls at
// once when the tab shows again or the browser comes back online. The answer is checked at the boundary: a body that
// is not a job status is a `jobs.failed` error, never trusted as one.
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { JOB_STATUS_ROUTE_ERRORS, JOB_STATUSES, type JobStatus, type JobStatusRouteErrorCode, type OwnJobStatus } from "../contract.js";
import { jobProgressSchema } from "../progress.js";

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_MAX_INTERVAL_MS = 15_000;
/** Growth of the interval per poll that saw no change. */
const IDLE_GROWTH = 1.5;
/** Growth of the interval per failed poll. */
const FAILURE_GROWTH = 2;
const TERMINAL_STATUSES: readonly JobStatus[] = ["succeeded", "failed", "cancelled"];

const isoTime = z.iso.datetime({ offset: true });

const ownJobStatusSchema = z.object({
  id: z.string(),
  queue: z.string(),
  status: z.enum(JOB_STATUSES),
  progress: jobProgressSchema.nullable(),
  progressAt: isoTime.nullable(),
  resultRef: z.string().nullable(),
  failureCode: z.string().nullable(),
  cancelRequestedAt: isoTime.nullable(),
  createdAt: isoTime,
  updatedAt: isoTime,
  finishedAt: isoTime.nullable(),
});

const errorBodySchema = z.object({ error: z.enum(JOB_STATUS_ROUTE_ERRORS) });

/** Why the last call gave no status: the route's code, or `network` when the request did not complete. */
export type JobStatusErrorCode = JobStatusRouteErrorCode | "network";

export interface UseJobStatusOptions {
  /** The route of one job; default `/api/jobs/<id>`, the path of `app/api/jobs/[id]/route.ts`. */
  readonly url?: (id: string) => string;
  /** The first interval between polls, and the interval right after a change; default 1000 ms. */
  readonly intervalMs?: number;
  /** The longest interval the backoff reaches; default 15 000 ms. */
  readonly maxIntervalMs?: number;
  /** Statuses after which polling stops; default `succeeded`, `failed` and `cancelled`. */
  readonly stopOn?: readonly JobStatus[];
}

export type CancelJobStatusResult = { readonly ok: true; readonly value: OwnJobStatus } | { readonly ok: false; readonly error: JobStatusErrorCode };

export interface JobStatusState {
  /** The newest status the route answered; null before the first answer. */
  readonly job: OwnJobStatus | null;
  /** Why the last poll gave no status; null after a good one. Polling stops on 401 and 404. */
  readonly error: JobStatusErrorCode | null;
  /** True while polls are scheduled (also while paused by a hidden tab); false once the job ended or polling stopped. */
  readonly isPolling: boolean;
  /** Asks the job to stop (`DELETE` on the route; the app enables it with `allowCancel`). */
  readonly cancel: () => Promise<CancelJobStatusResult>;
}

interface Snapshot {
  readonly id: string | null;
  readonly job: OwnJobStatus | null;
  readonly error: JobStatusErrorCode | null;
  readonly isPolling: boolean;
}

function defaultUrl(id: string): string {
  return `/api/jobs/${encodeURIComponent(id)}`;
}

/**
 * Follows a job its signed-in owner started: `const { job, error, cancel } = useJobStatus(jobId)`. Pass null while
 * there is no job yet. Shows `job.progress`, then `job.resultRef` (succeeded) or `job.failureCode` (failed or
 * cancelled).
 */
export function useJobStatus(id: string | null, options: UseJobStatusOptions = {}): JobStatusState {
  const url = options.url ?? defaultUrl;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxIntervalMs = Math.max(options.maxIntervalMs ?? DEFAULT_MAX_INTERVAL_MS, intervalMs);
  const stopOn = options.stopOn ?? TERMINAL_STATUSES;
  const target = id === null ? null : url(id);
  const stopOnKey = stopOn.join(",");

  const [snapshot, setSnapshot] = useState<Snapshot>({ id: null, job: null, error: null, isPolling: false });
  const pollNow = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (id === null || target === null) return undefined;
    const stopStatuses = stopOnKey.split(",");
    let isStopped = false;
    let isEnded = false;
    let isInFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delayMs = intervalMs;
    let lastSeen: string | null = null;
    const controller = new AbortController();
    setSnapshot({ id, job: null, error: null, isPolling: true });

    const update = (change: Partial<Snapshot>) => {
      if (!isStopped) setSnapshot((previous) => ({ ...previous, id, ...change }));
    };
    const end = (change: Partial<Snapshot>) => {
      isEnded = true;
      clearTimeout(timer);
      update({ ...change, isPolling: false });
    };
    const schedule = () => {
      clearTimeout(timer);
      if (isStopped || isEnded || document.visibilityState === "hidden") return;
      timer = setTimeout(() => void poll(), delayMs);
    };
    const poll = async () => {
      if (isStopped || isEnded || isInFlight) return;
      if (document.visibilityState === "hidden") return;
      isInFlight = true;
      try {
        const response = await fetch(target, { cache: "no-store", headers: { accept: "application/json" }, signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        if (isStopped) return;
        if (response.ok) {
          const parsed = ownJobStatusSchema.safeParse(body);
          if (!parsed.success) {
            delayMs = Math.min(delayMs * FAILURE_GROWTH, maxIntervalMs);
            update({ error: "jobs.failed" });
            return;
          }
          const job = parsed.data;
          const seen = `${job.status}|${job.updatedAt}|${job.progressAt ?? ""}|${job.cancelRequestedAt ?? ""}`;
          delayMs = seen === lastSeen ? Math.min(delayMs * IDLE_GROWTH, maxIntervalMs) : intervalMs;
          lastSeen = seen;
          if (stopStatuses.includes(job.status)) end({ job, error: null });
          else update({ job, error: null });
          return;
        }
        const code = readErrorCode(body, response.status);
        if (response.status === 401 || response.status === 404) {
          end({ error: code });
          return;
        }
        delayMs = Math.min(delayMs * FAILURE_GROWTH, maxIntervalMs);
        update({ error: code });
      } catch {
        if (isStopped) return;
        delayMs = Math.min(delayMs * FAILURE_GROWTH, maxIntervalMs);
        update({ error: "network" });
      } finally {
        isInFlight = false;
        schedule();
      }
    };
    const resume = () => {
      if (isStopped || isEnded || document.visibilityState === "hidden") return;
      clearTimeout(timer);
      delayMs = intervalMs;
      void poll();
    };
    pollNow.current = resume;
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    void poll();

    return () => {
      isStopped = true;
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      pollNow.current = () => undefined;
    };
  }, [id, target, intervalMs, maxIntervalMs, stopOnKey]);

  const cancel = useCallback(async (): Promise<CancelJobStatusResult> => {
    if (target === null) return { ok: false, error: "jobs.not_found" };
    try {
      const response = await fetch(target, { method: "DELETE", cache: "no-store", headers: { accept: "application/json" } });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) return { ok: false, error: readErrorCode(body, response.status) };
      const parsed = ownJobStatusSchema.safeParse(body);
      if (!parsed.success) return { ok: false, error: "jobs.failed" };
      pollNow.current();
      return { ok: true, value: parsed.data };
    } catch {
      return { ok: false, error: "network" };
    }
  }, [target]);

  const isCurrent = snapshot.id === id && id !== null;
  return {
    job: isCurrent ? snapshot.job : null,
    error: isCurrent ? snapshot.error : null,
    isPolling: isCurrent && snapshot.isPolling,
    cancel,
  };
}

function readErrorCode(body: unknown, status: number): JobStatusErrorCode {
  const parsed = errorBodySchema.safeParse(body);
  if (parsed.success) return parsed.data.error;
  return status === 401 ? "auth.unauthorized" : status === 404 ? "jobs.not_found" : "jobs.failed";
}
