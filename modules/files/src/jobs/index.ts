// The jobs adapter of @softure-ai/files: the prune as a `@softure-ai/jobs` handler and schedule (an optional peer
// dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { PRUNE_REPORT_MAX_FILE_IDS, pruneFiles, type PruneFilesReport } from "../server/prune.js";

export type FilesJobsLogFields = Readonly<Record<string, unknown>>;

/**
 * Where the files jobs report a run. A subset of `@softure-ai/observability`'s `Logger`, so an app passes
 * `createLogger("files")` as it is; without one, lines go to the console.
 */
export interface FilesJobsLogger {
  info(message: string, fields?: FilesJobsLogFields): void;
}

export interface CreateFilesJobHandlersOptions {
  readonly logger?: FilesJobsLogger;
}

const PREFIX = "@softure-ai/files:";

/** One `key=value` line per call; an array is joined with commas. */
export const consoleFilesJobsLogger: FilesJobsLogger = {
  info: (message, fields) => console.log(formatLine(message, fields)),
};

/**
 * Handlers for the worker with a logger of the app's choice: `handlers: { ...createFilesJobHandlers({ logger }) }`.
 * Every `files.prune` run logs one line `files.prune finished` with `removed`, `freedBytes`, `failedFiles`,
 * `deletedUploads`, `failedUploads` and, when at most 10 files went, their ids as `fileIds`.
 */
export function createFilesJobHandlers(options: CreateFilesJobHandlersOptions = {}) {
  const logger = options.logger ?? consoleFilesJobsLogger;
  return {
    /** Removes expired and deleted files from storage and the table (`pruneFiles`). */
    "files.prune": defineJobHandler({
      payload: z.object({}),
      run: async (_payload, ctx) => {
        logger.info("files.prune finished", getPruneLogFields(await pruneFiles(ctx)));
        return ok();
      },
    }),
  } satisfies JobHandlers;
}

/** Handlers for the worker: `handlers: { ...filesJobHandlers }`; they log to the console. */
export const filesJobHandlers = createFilesJobHandlers();

/** Schedules for `jobs({ schedules: { ...filesJobSchedules } })`: hourly. */
export const filesJobSchedules = {
  "files.prune": { every: "1h" },
} satisfies JobSchedulesInput;

function getPruneLogFields(report: PruneFilesReport): FilesJobsLogFields {
  const fields = {
    removed: report.deletedFiles,
    freedBytes: report.freedBytes,
    failedFiles: report.failedFiles,
    deletedUploads: report.deletedUploads,
    failedUploads: report.failedUploads,
  };
  return report.deletedFiles > PRUNE_REPORT_MAX_FILE_IDS ? fields : { ...fields, fileIds: report.removedFileIds };
}

function formatLine(message: string, fields: FilesJobsLogFields | undefined): string {
  const parts = Object.entries(fields ?? {}).map(([key, value]) => `${key}=${formatValue(value)}`);
  return [PREFIX, message, ...parts].join(" ");
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(",");
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}
