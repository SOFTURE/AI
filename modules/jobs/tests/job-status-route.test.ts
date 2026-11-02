// The status route of an owned job (issue #958): the app's session decides who asks, the module answers only that
// owner, codes only, never cached; DELETE cancels only when the app allows it.
import { createJobStatusRoute, type JobStatusRouteOptions } from "@softure-ai/jobs/next";
import { claimJobs, enqueueJob, getJob } from "@softure-ai/jobs/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestJobs, NOW, type TestJobs } from "./support.js";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("test: notFound");
  },
}));

describe("createJobStatusRoute", () => {
  let test: TestJobs;
  let ownerId: string | null;

  beforeEach(async () => {
    test = await createTestJobs();
    ownerId = "user-1";
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  function createRoute(options: Partial<JobStatusRouteOptions> = {}) {
    return createJobStatusRoute({ getOwnerId: () => Promise.resolve(ownerId), getContext: () => Promise.resolve(test.ctx), ...options });
  }

  function call(handler: ReturnType<typeof createRoute>["GET"], id: string, method = "GET") {
    return handler(new Request(`http://localhost/api/jobs/${id}`, { method }), { params: Promise.resolve({ id }) });
  }

  async function enqueueOwned(owner = "user-1") {
    return (await enqueueJob(test.ctx, { queue: "ai.reply", payload: { secret: "payload-text" }, ownerId: owner })).id;
  }

  it("answers the owner with the job's status as JSON, never cached and without the payload", async () => {
    const id = await enqueueOwned();
    const response = await call(createRoute().GET, id);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain("payload-text");
    expect(JSON.parse(body)).toEqual({
      id,
      queue: "ai.reply",
      status: "pending",
      progress: null,
      progressAt: null,
      resultRef: null,
      failureCode: null,
      cancelRequestedAt: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      finishedAt: null,
    });
  });

  it("answers 401 without a signed-in user and 404 for a job of someone else", async () => {
    const id = await enqueueOwned("user-2");
    ownerId = null;
    const anonymous = await call(createRoute().GET, id);
    expect([anonymous.status, await anonymous.json(), anonymous.headers.get("cache-control")]).toEqual([401, { error: "auth.unauthorized" }, "no-store"]);
    ownerId = "user-1";
    const foreign = await call(createRoute().GET, id);
    expect([foreign.status, await foreign.json()]).toEqual([404, { error: "jobs.not_found" }]);
    const unknown = await call(createRoute().GET, "not-an-id");
    expect(unknown.status).toBe(404);
  });

  it("refuses DELETE unless the app allows cancelling", async () => {
    const id = await enqueueOwned();
    const response = await call(createRoute().DELETE, id, "DELETE");
    expect([response.status, await response.json(), response.headers.get("allow")]).toEqual([405, { error: "jobs.cancel_not_allowed" }, "GET"]);
    expect((await getJob(test.ctx, id))?.status).toBe("pending");
  });

  it("lets the owner cancel with DELETE when allowed: pending cancelled, running asked to stop, finished refused", async () => {
    const route = createRoute({ allowCancel: true });
    const pending = await enqueueOwned();
    const cancelled = await call(route.DELETE, pending, "DELETE");
    expect([cancelled.status, (await cancelled.json()) as unknown]).toEqual([200, expect.objectContaining({ status: "cancelled", failureCode: "jobs.cancelled" })]);
    const again = await call(route.DELETE, pending, "DELETE");
    expect([again.status, await again.json()]).toEqual([409, { error: "jobs.not_cancellable" }]);

    const running = await enqueueOwned();
    await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "test" });
    const requested = await call(route.DELETE, running, "DELETE");
    expect([requested.status, (await requested.json()) as unknown]).toEqual([200, expect.objectContaining({ status: "running", cancelRequestedAt: NOW.toISOString() })]);

    const foreign = await enqueueOwned("user-2");
    expect((await call(route.DELETE, foreign, "DELETE")).status).toBe(404);
    expect((await getJob(test.ctx, foreign))?.status).toBe("pending");
  });

  it("answers 503 when the database cannot be opened and 500 when the session lookup throws, logging the kind only", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const closed = createRoute({ getContext: () => Promise.reject(new Error("connect ECONNREFUSED secret-host")) });
    const unavailable = await call(closed.GET, "1");
    expect([unavailable.status, await unavailable.json()]).toEqual([503, { error: "jobs.unavailable" }]);
    const broken = createRoute({ getOwnerId: () => Promise.reject(new Error("session store down")) });
    const failed = await call(broken.GET, "1");
    expect([failed.status, await failed.json()]).toEqual([500, { error: "jobs.failed" }]);
    expect(errors).toHaveBeenCalledTimes(2);
    expect(errors.mock.calls.flat().join("\n")).not.toContain("secret-host");
  });
});
