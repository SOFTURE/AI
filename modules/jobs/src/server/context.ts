import type { ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";

/** `{ db, clock, config }`; `db` may be an open transaction, so a job is enqueued with the caller's own write. */
export type JobsContext = ModuleContext<Queryable>;
