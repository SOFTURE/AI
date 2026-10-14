// Which queues a runner works on: the configured queues that have a handler, optionally narrowed. A handler for a
// queue the config does not define is a typo and refused.
import type { JobHandlers } from "../handlers.js";
import type { JobsOptions } from "../options.js";

export function checkHandlers(options: JobsOptions, handlers: JobHandlers, only: readonly string[] | undefined): string[] {
  const configured = Object.keys(options.queues);
  const unknown = Object.keys(handlers).filter((queue) => !configured.includes(queue));
  if (unknown.length > 0) {
    throw new Error(`@softure-ai/jobs: handlers for queues the config does not define: ${unknown.join(", ")}; configured queues: ${configured.join(", ")}`);
  }
  for (const queue of Object.keys(handlers)) {
    const handler = handlers[queue];
    if (typeof handler?.run !== "function" || typeof handler.payload?.safeParse !== "function") {
      throw new Error(`@softure-ai/jobs: the handler for "${queue}" is not a job handler; define it with defineJobHandler({ payload, run })`);
    }
  }
  const unknownOnly = (only ?? []).filter((queue) => !configured.includes(queue));
  if (unknownOnly.length > 0) {
    throw new Error(`@softure-ai/jobs: unknown queues requested: ${unknownOnly.join(", ")}`);
  }
  const withoutHandler = (only ?? []).filter((queue) => !Object.hasOwn(handlers, queue));
  if (withoutHandler.length > 0) {
    throw new Error(`@softure-ai/jobs: no handler for requested queues: ${withoutHandler.join(", ")}`);
  }
  return (only ?? configured).filter((queue) => Object.hasOwn(handlers, queue));
}
