// The jobs worker on Cloudflare Workers: a `scheduled()` handler for a Cron Trigger (every minute) that runs one
// `runJobsTick` on the request database (`withRequestDatabase` on the Hyperdrive URL from the Worker's env) and keeps
// the invocation alive with `waitUntil` until every job it started has settled (docs/07-runtime-providers.md).
import type { SoftureConfig } from "@softure-ai/core";
import { withRequestDatabase } from "@softure-ai/db/request";
import type { JobHandlers } from "../handlers.js";
import { consoleJobsLogger, type JobsLogger } from "../server/logger.js";
import { runJobsTick, type RunJobsTickOptions, type RunJobsTickReport } from "../server/tick.js";

/** The part of Cloudflare's `ScheduledController` the handler reads. */
export interface ScheduledControllerLike {
  /** When the Cron Trigger fired, epoch ms. */
  readonly scheduledTime: number;
  readonly cron: string;
}

/** The part of Cloudflare's `ExecutionContext` the handler uses. */
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface CreateScheduledHandlerOptions<Env>
  extends Pick<RunJobsTickOptions, "queues" | "budgetMs" | "workerName" | "random" | "heartbeatMs"> {
  readonly config: SoftureConfig;
  readonly handlers: JobHandlers;
  /** The database URL of one tick, from the Worker's env: `(env) => env.HYPERDRIVE.connectionString`. */
  readonly databaseUrl: (env: Env) => string;
  readonly logger?: JobsLogger;
}

export type ScheduledHandler<Env> = (controller: ScheduledControllerLike, env: Env, ctx: ExecutionContextLike) => Promise<RunJobsTickReport>;

/**
 * The Worker's `scheduled` export. Each firing runs one tick named after its `scheduledTime` (`locked_by`
 * `<workerName>:<ISO time>`) and resolves with its report; a tick that could not run (no handler, no database) is
 * logged as `error` and rejects, so the Cron Trigger's run shows as failed.
 *
 *   // worker.ts
 *   import { createScheduledHandler } from "@softure-ai/jobs/workers";
 *   const scheduled = createScheduledHandler({ config, handlers, databaseUrl: (env: Env) => env.HYPERDRIVE.connectionString });
 *   export default { fetch: app.fetch, scheduled };
 */
export function createScheduledHandler<Env>(options: CreateScheduledHandlerOptions<Env>): ScheduledHandler<Env> {
  const logger = options.logger ?? consoleJobsLogger;
  return (controller, env, ctx) => {
    const waitUntil = (promise: Promise<unknown>) => ctx.waitUntil(promise);
    const tick = runTick({ options, logger, controller, env, waitUntil });
    waitUntil(tick.catch(() => undefined));
    return tick;
  };
}

interface RunTickInput<Env> {
  readonly options: CreateScheduledHandlerOptions<Env>;
  readonly logger: JobsLogger;
  readonly controller: ScheduledControllerLike;
  readonly env: Env;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

async function runTick<Env>({ options, logger, controller, env, waitUntil }: RunTickInput<Env>): Promise<RunJobsTickReport> {
  const workerName = options.workerName;
  const runId = `${workerName ?? "tick"}:${new Date(controller.scheduledTime).toISOString()}`;
  try {
    const url = options.databaseUrl(env);
    return await withRequestDatabase({ url, waitUntil }, () =>
      runJobsTick({
        config: options.config,
        handlers: options.handlers,
        logger,
        runId,
        ...(options.queues === undefined ? {} : { queues: options.queues }),
        ...(options.budgetMs === undefined ? {} : { budgetMs: options.budgetMs }),
        ...(workerName === undefined ? {} : { workerName }),
        ...(options.random === undefined ? {} : { random: options.random }),
        ...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
      }),
    );
  } catch (error) {
    logger.error(`the jobs tick failed: ${error instanceof Error ? error.message : "unknown error"}`, { cron: controller.cron, error });
    throw error;
  }
}
