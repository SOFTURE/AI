// The status route of a job its owner follows, mounted with one line in `app/api/jobs/[id]/route.ts`:
// `export const { GET, DELETE } = createJobStatusRoute({ getOwnerId: async () => (await getCurrentUser())?.id ?? null });`
// The session check is the app's (jobs does not depend on auth); the owner check is the module's. `GET` answers the
// job's `OwnJobStatus`, `DELETE` asks it to stop when `allowCancel` is on. Every answer is `no-store`: a cached status
// would freeze the waiting screen.
import { errorLogLabel } from "@softure-ai/core";
import type { JobStatusRouteErrorCode, OwnJobStatus } from "../contract.js";
import type { JobsContext } from "../server/context.js";
import { getOwnJob, requestOwnJobCancel, toOwnJobStatus } from "../server/own-jobs.js";
import { getJobsContext } from "./context.js";

/** The second argument Next.js passes a handler of a `[id]` segment. */
export interface JobStatusRouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export type JobStatusRouteHandler = (request: Request, route: JobStatusRouteContext) => Promise<Response>;

export interface JobStatusRoute {
  readonly GET: JobStatusRouteHandler;
  readonly DELETE: JobStatusRouteHandler;
}

export interface JobStatusRouteOptions {
  /**
   * The signed-in user's id, the same value the app passed to `enqueueJob({ ownerId })`; null when nobody is signed in
   * (the route answers 401). Typically the app's session lookup through auth.
   */
  readonly getOwnerId: (request: Request) => Promise<string | null>;
  /** Lets the owner cancel the job with `DELETE` (`requestOwnJobCancel`); off by default (405). */
  readonly allowCancel?: boolean;
  /** The context the route reads; `getJobsContext()` (the registered config's database) by default. */
  readonly getContext?: () => Promise<JobsContext>;
}

/** The error body of the route: a code, never a message. */
export interface JobStatusRouteError {
  readonly error: JobStatusRouteErrorCode;
}

const NO_STORE = { "cache-control": "no-store" } as const;

export function createJobStatusRoute(options: JobStatusRouteOptions): JobStatusRoute {
  const getContext = options.getContext ?? (() => getJobsContext());

  const handle =
    (operation: string, answer: (ctx: JobsContext, input: { id: string; ownerId: string }) => Promise<Response>): JobStatusRouteHandler =>
    async (request, route) => {
      let ownerId: string | null;
      let id: string;
      try {
        ownerId = await options.getOwnerId(request);
        ({ id } = await route.params);
      } catch (error) {
        console.error(`@softure-ai/jobs: ${operation}: reading the session failed: ${errorLogLabel(error)}`);
        return respondError(500, "jobs.failed");
      }
      if (ownerId === null) return respondError(401, "auth.unauthorized");
      let ctx: JobsContext;
      try {
        ctx = await getContext();
      } catch (error) {
        console.error(`@softure-ai/jobs: ${operation}: opening the database failed: ${errorLogLabel(error)}`);
        return respondError(503, "jobs.unavailable");
      }
      try {
        return await answer(ctx, { id, ownerId });
      } catch (error) {
        console.error(`@softure-ai/jobs: ${operation} failed: ${errorLogLabel(error)}`);
        return respondError(500, "jobs.failed");
      }
    };

  const GET = handle("reading a job status", async (ctx, input) => {
    const result = await getOwnJob(ctx, input);
    return result.ok ? respondJob(toOwnJobStatus(result.value)) : respondError(404, result.error);
  });

  const cancel = handle("cancelling an own job", async (ctx, input) => {
    const result = await requestOwnJobCancel(ctx, input);
    if (result.ok) return respondJob(toOwnJobStatus(result.value));
    return respondError(result.error === "jobs.not_found" ? 404 : 409, result.error);
  });
  const DELETE: JobStatusRouteHandler = (request, route) =>
    options.allowCancel === true
      ? cancel(request, route)
      : Promise.resolve(Response.json({ error: "jobs.cancel_not_allowed" } satisfies JobStatusRouteError, { status: 405, headers: { ...NO_STORE, allow: "GET" } }));

  return { GET, DELETE };
}

function respondJob(job: OwnJobStatus): Response {
  return Response.json(job, { headers: NO_STORE });
}

function respondError(status: number, error: JobStatusRouteError["error"]): Response {
  return Response.json({ error } satisfies JobStatusRouteError, { status, headers: NO_STORE });
}
