// The jobs adapter of @softure-ai/files: the prune as a `@softure-ai/jobs` handler and schedule (an optional peer
// dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { pruneFiles } from "../server/prune.js";

/** Handlers for the worker: `handlers: { ...filesJobHandlers }`. */
export const filesJobHandlers = {
  /** Removes expired and deleted files from storage and the table (`pruneFiles`). */
  "files.prune": defineJobHandler({
    payload: z.object({}),
    run: async (_payload, ctx) => {
      await pruneFiles(ctx);
      return ok();
    },
  }),
} satisfies JobHandlers;

/** Schedules for `jobs({ schedules: { ...filesJobSchedules } })`: hourly. */
export const filesJobSchedules = {
  "files.prune": { every: "1h" },
} satisfies JobSchedulesInput;
