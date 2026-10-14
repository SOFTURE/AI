// The jobs options of the running app, read from the configuration in the module context.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { MODULE_ID } from "../index.js";
import type { JobQueueOptions, JobsOptions } from "../options.js";

/** Throws when the app did not enable the module: calling its functions then is a bug. */
export function getJobsOptions(config: SoftureConfig): JobsOptions {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/jobs: the module is not enabled; add jobs({ queues: { ... } }) to modules in softure.config.ts");
  }
  // The module factory parsed these options with jobsOptionsSchema.
  return module.options as JobsOptions;
}

/** Throws on a queue the configuration does not define: a typo in code, not a user error. */
export function getQueue(options: JobsOptions, name: string): JobQueueOptions {
  const queue = Object.hasOwn(options.queues, name) ? options.queues[name] : undefined;
  if (queue === undefined) {
    const known = Object.keys(options.queues).join(", ");
    throw new Error(`@softure-ai/jobs: unknown queue "${name}"; configured queues: ${known}`);
  }
  return queue;
}
