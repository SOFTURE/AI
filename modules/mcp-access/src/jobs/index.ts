// The jobs adapter of @softure-ai/mcp-access: its daily cleanup as a `@softure-ai/jobs` handler and schedule (an
// optional peer dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { pruneMcpAccess } from "../server/prune.js";

/** Handlers for the worker: `handlers: { ...mcpAccessJobHandlers }`. */
export const mcpAccessJobHandlers = {
  /** Deletes expired access tokens and dead OAuth records (`pruneMcpAccess`). */
  "mcp-access.prune": defineJobHandler({
    payload: z.object({}),
    run: async (_payload, ctx) => {
      await pruneMcpAccess(ctx);
      return ok();
    },
  }),
} satisfies JobHandlers;

/** Schedules for `jobs({ schedules: { ...mcpAccessJobSchedules } })`: daily. */
export const mcpAccessJobSchedules = {
  "mcp-access.prune": { every: "1d" },
} satisfies JobSchedulesInput;
