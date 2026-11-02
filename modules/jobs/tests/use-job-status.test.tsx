// @vitest-environment happy-dom
// The waiting screen's hook (issue #958): polls the status route with backoff, stops when the job ends or the route
// says 401/404, pauses while the tab is hidden, polls at once on `visibilitychange` and `online`, cancels with DELETE.
import type { OwnJobStatus } from "@softure-ai/jobs";
import { useJobStatus, type UseJobStatusOptions } from "@softure-ai/jobs/react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const AT = "2026-09-15T12:00:00.000Z";

function status(change: Partial<OwnJobStatus> = {}): OwnJobStatus {
  return {
    id: "7",
    queue: "ai.reply",
    status: "running",
    progress: null,
    progressAt: null,
    resultRef: null,
    failureCode: null,
    cancelRequestedAt: null,
    createdAt: AT,
    updatedAt: AT,
    finishedAt: null,
    ...change,
  };
}

type Answer = { readonly status: number; readonly body: unknown } | Error;

let answers: Answer[];
let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
let hidden: boolean;

function answer(...next: Answer[]): void {
  answers.push(...next);
}

function ok(body: unknown): Answer {
  return { status: 200, body };
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function calls(): number {
  return fetchMock.mock.calls.length;
}

function render(id: string | null, options?: UseJobStatusOptions) {
  return renderHook(({ jobId }: { jobId: string | null }) => useJobStatus(jobId, options), { initialProps: { jobId: id } });
}

beforeEach(() => {
  vi.useFakeTimers();
  answers = [];
  hidden = false;
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
  fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => {
    const next = answers.shift() ?? ok(status());
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status, headers: { "content-type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useJobStatus", () => {
  it("does nothing without a job id", async () => {
    const { result } = render(null);
    await wait(5000);
    expect(calls()).toBe(0);
    expect(result.current).toMatchObject({ job: null, error: null, isPolling: false });
  });

  it("polls the default route without caching and stops once the job succeeded", async () => {
    answer(ok(status({ progress: { step: "ai.summarize", done: 1, total: 3 }, progressAt: AT })), ok(status({ status: "succeeded", resultRef: "summary:1", finishedAt: AT })));
    const { result } = render("7");
    await flush();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/jobs/7");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
    expect(result.current).toMatchObject({ job: { status: "running", progress: { step: "ai.summarize", done: 1, total: 3 } }, isPolling: true });
    await wait(1000);
    expect(result.current).toMatchObject({ job: { status: "succeeded", resultRef: "summary:1" }, error: null, isPolling: false });
    await wait(60_000);
    expect(calls()).toBe(2);
  });

  it("backs off by half while nothing changes, up to the maximum, and resets on a change", async () => {
    render("7", { intervalMs: 1000, maxIntervalMs: 2000 });
    await flush();
    expect(calls()).toBe(1);
    await wait(1000);
    expect(calls()).toBe(2);
    // Unchanged: the next poll waits 1500 ms, then 2000 ms (the maximum).
    await wait(1499);
    expect(calls()).toBe(2);
    await wait(1);
    expect(calls()).toBe(3);
    answer(ok(status({ progress: { step: "ai.summarize" }, progressAt: "2026-09-15T12:00:05.000Z" })));
    await wait(2000);
    expect(calls()).toBe(4);
    // Changed: back to 1000 ms.
    await wait(1000);
    expect(calls()).toBe(5);
  });

  it("stops on 404 and 401 with the route's code", async () => {
    answer({ status: 404, body: { error: "jobs.not_found" } });
    const missing = render("7");
    await flush();
    expect(missing.result.current).toMatchObject({ job: null, error: "jobs.not_found", isPolling: false });
    await wait(30_000);
    expect(calls()).toBe(1);
    missing.unmount();

    answer({ status: 401, body: { error: "auth.unauthorized" } });
    const anonymous = render("8");
    await flush();
    expect(anonymous.result.current).toMatchObject({ error: "auth.unauthorized", isPolling: false });
  });

  it("keeps polling after a network failure or a 503, doubling the interval, and clears the error on success", async () => {
    answer(new TypeError("Failed to fetch"), { status: 503, body: { error: "jobs.unavailable" } }, { status: 200, body: { unexpected: true } });
    const { result } = render("7", { intervalMs: 1000, maxIntervalMs: 10_000 });
    await flush();
    expect(result.current).toMatchObject({ error: "network", isPolling: true });
    await wait(2000);
    expect(result.current.error).toBe("jobs.unavailable");
    await wait(4000);
    expect(calls()).toBe(3);
    expect(result.current.error).toBe("jobs.failed");
    await wait(8000);
    expect(result.current).toMatchObject({ job: { status: "running" }, error: null });
  });

  it("pauses while the tab is hidden and polls at once when it shows again or the browser comes online", async () => {
    render("7");
    await flush();
    hidden = true;
    await wait(30_000);
    expect(calls()).toBe(1);
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(calls()).toBe(2);
    window.dispatchEvent(new Event("online"));
    await flush();
    expect(calls()).toBe(3);
  });

  it("cancels with DELETE and stops once the job is cancelled", async () => {
    const { result } = render("7", { url: (id) => `/app/runs/${id}/status` });
    await flush();
    answer(ok(status({ status: "cancelled", failureCode: "jobs.cancelled", finishedAt: AT })), ok(status({ status: "cancelled", failureCode: "jobs.cancelled", finishedAt: AT })));
    let cancelled: unknown;
    await act(async () => {
      cancelled = await result.current.cancel();
    });
    expect(fetchMock.mock.calls[1]).toEqual(["/app/runs/7/status", expect.objectContaining({ method: "DELETE" })]);
    expect(cancelled).toMatchObject({ ok: true, value: { status: "cancelled" } });
    await flush();
    expect(result.current).toMatchObject({ job: { status: "cancelled", failureCode: "jobs.cancelled" }, isPolling: false });
  });

  it("returns the route's refusal of a cancel", async () => {
    const { result } = render("7");
    await flush();
    answer({ status: 405, body: { error: "jobs.cancel_not_allowed" } });
    let refused: unknown;
    await act(async () => {
      refused = await result.current.cancel();
    });
    expect(refused).toEqual({ ok: false, error: "jobs.cancel_not_allowed" });
  });

  it("starts over for a new job id", async () => {
    answer(ok(status({ status: "succeeded", finishedAt: AT })));
    const { result, rerender } = render("7");
    await flush();
    expect(result.current.job?.status).toBe("succeeded");
    answer(ok(status({ id: "8" })));
    rerender({ jobId: "8" });
    expect(result.current.job).toBeNull();
    await flush();
    expect(result.current).toMatchObject({ job: { id: "8", status: "running" }, isPolling: true });
  });
});
