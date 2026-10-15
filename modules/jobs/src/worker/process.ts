// The worker as a process: what an app's `scripts/worker.ts` calls. It opens its own database pool, turns SIGTERM and
// SIGINT into a graceful stop, closes the pool and reports an exit code.
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import { openCommandDatabase, type Database } from "@softure-ai/db";
import type { JobHandlers } from "../handlers.js";
import { consoleJobsLogger, type JobsLogger } from "../server/logger.js";
import { getJobsOptions } from "../server/options.js";
import { runJobWorker, type RunJobWorkerOptions } from "./run-job-worker.js";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const STOP_SIGNALS = ["SIGTERM", "SIGINT"] as const;

export interface RunJobWorkerProcessOptions extends Partial<Pick<RunJobWorkerOptions, "queues" | "clock" | "workerId" | "random" | "heartbeatMs">> {
  readonly config: SoftureConfig;
  readonly handlers: JobHandlers;
  readonly logger?: JobsLogger;
  /** An open database to use instead of opening one (tests); it is not closed. */
  readonly database?: Database;
  /** Stops the worker instead of SIGTERM and SIGINT (tests). */
  readonly signal?: AbortSignal;
}

/**
 * Runs the worker until SIGTERM or SIGINT, then stops gracefully. Resolves to the exit code and sets
 * `process.exitCode`: 0 after a clean stop, 1 when it could not start or the database could not be opened.
 *
 *   // scripts/worker.ts
 *   import { runJobWorkerProcess } from "@softure-ai/jobs/worker";
 *   import config from "../softure.config";
 *   import { handlers } from "../src/jobs/handlers";
 *   await runJobWorkerProcess({ config, handlers });
 */
export async function runJobWorkerProcess(options: RunJobWorkerProcessOptions): Promise<number> {
  const exitCode = await runProcess(options);
  process.exitCode = exitCode;
  return exitCode;
}

async function runProcess(options: RunJobWorkerProcessOptions): Promise<number> {
  const logger = options.logger ?? consoleJobsLogger;
  const database = options.config.database;
  if (options.database === undefined && database === null) {
    logger.error("the config has no database; set database.url in softure.config");
    return EXIT_FAILED;
  }

  let opened: { db: Database; close: () => Promise<void> };
  try {
    opened = await openDatabase(options, database);
  } catch (error) {
    logger.error("could not open the database", { error });
    return EXIT_FAILED;
  }

  const controller = new AbortController();
  const stop = () => controller.abort();
  const external = options.signal;
  if (external === undefined) {
    for (const signal of STOP_SIGNALS) process.once(signal, stop);
  } else if (external.aborted) {
    stop();
  } else {
    external.addEventListener("abort", stop, { once: true });
  }

  try {
    await runJobWorker({ ...options, db: opened.db, logger, signal: controller.signal });
    return EXIT_OK;
  } catch (error) {
    logger.error(`the worker failed: ${error instanceof Error ? error.message : errorLogLabel(error)}`, { error });
    return EXIT_FAILED;
  } finally {
    for (const signal of STOP_SIGNALS) process.removeListener(signal, stop);
    external?.removeEventListener("abort", stop);
    await opened.close().catch((error: unknown) => logger.error("could not close the database", { error }));
  }
}

async function openDatabase(
  options: RunJobWorkerProcessOptions,
  database: SoftureConfig["database"],
): Promise<{ db: Database; close: () => Promise<void> }> {
  if (options.database !== undefined) return { db: options.database, close: () => Promise.resolve() };
  if (database === null) throw new Error("no database");
  // One connection per job that can run at once, one for claims and heartbeats.
  const concurrency = Object.values(getJobsOptions(options.config).queues).reduce((sum, queue) => sum + queue.concurrency, 0);
  const command = await openCommandDatabase(database, { max: concurrency + 1 });
  return { db: command.handle.db, close: command.close };
}
