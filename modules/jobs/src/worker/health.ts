// The worker's heartbeat: a file the loop touches after each round whose claims reached the database, and the check
// an image runs (`node worker.mjs --health`) to tell a running loop from a process that only stays alive.
import { rmSync, statSync, writeFileSync } from "node:fs";
import type { SoftureConfig } from "@softure-ai/core";
import type { JobsLogger } from "../server/logger.js";
import { getJobsOptions } from "../server/options.js";

/** The age limit never drops below this, so a slow round (an hourly prune) does not read as a stuck loop. */
const MIN_HEALTH_MAX_AGE_MS = 30_000;
const POLL_INTERVALS_PER_MAX_AGE = 5;

export type JobWorkerHealth = { ok: true; ageMs: number } | { ok: false; reason: "missing" } | { ok: false; reason: "stale"; ageMs: number };

export interface CheckJobWorkerHealthInput {
  readonly healthFile: string;
  /** The oldest heartbeat that still counts; `getJobWorkerHealthMaxAgeMs(config)` by default in the process. */
  readonly maxAgeMs: number;
  /** Epoch ms to compare the file's modification time with; default `Date.now()`. */
  readonly now?: number;
}

/** The default age limit: five poll intervals, at least 30 s. */
export function getJobWorkerHealthMaxAgeMs(config: SoftureConfig): number {
  return Math.max(MIN_HEALTH_MAX_AGE_MS, POLL_INTERVALS_PER_MAX_AGE * getJobsOptions(config).pollIntervalMs);
}

/** Whether the heartbeat file exists and is no older than `maxAgeMs`. Reads the file system only. */
export function checkJobWorkerHealth(input: CheckJobWorkerHealthInput): JobWorkerHealth {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(input.healthFile).mtimeMs;
  } catch {
    return { ok: false, reason: "missing" };
  }
  const ageMs = Math.max(0, Math.round((input.now ?? Date.now()) - mtimeMs));
  return ageMs > input.maxAgeMs ? { ok: false, reason: "stale", ageMs } : { ok: true, ageMs };
}

/** Writes and removes the heartbeat file; a failure is logged once until a write succeeds again, never thrown. */
export function createHealthFile(healthFile: string, logger: JobsLogger): { touch: () => void; remove: () => void } {
  let hasFailed = false;
  const report = (operation: string, error: unknown) => {
    if (hasFailed) return;
    hasFailed = true;
    logger.error(`could not ${operation} the worker's health file`, { healthFile, error });
  };
  return {
    touch: () => {
      try {
        writeFileSync(healthFile, new Date().toISOString());
        hasFailed = false;
      } catch (error) {
        report("write", error);
      }
    },
    remove: () => {
      try {
        rmSync(healthFile, { force: true });
      } catch (error) {
        report("remove", error);
      }
    },
  };
}
