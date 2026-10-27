// The run summary a handler may return with `ok({ summary })`: codes and counts only, so the run history never holds
// the app's data. The module checks it before writing; an invalid one is dropped with a warning, never failing a job
// that did its work.
import { z } from "zod";

/** A result code such as `sync.no_changes`; the same shape as a queue name. */
const CODE = /^[a-z][a-z0-9_.-]{0,62}$/;
const MAX_STEPS = 50;

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const JOB_STEP_OUTCOMES = ["done", "skipped", "failed"] as const;

export type JobStepOutcome = (typeof JOB_STEP_OUTCOMES)[number];

export const jobRunSummarySchema = z.strictObject({
  /** What the run came to, as a code: `sync.imported`, `sync.no_changes`. */
  code: z.string().regex(CODE).optional(),
  /** How many items the run handled, by what happened to them. */
  items: z.strictObject({ new: count.optional(), skipped: count.optional(), failed: count.optional() }).optional(),
  /** One outcome per step the handler declares, by step name (at most 50). */
  steps: z
    .record(z.string().regex(CODE), z.enum(JOB_STEP_OUTCOMES))
    .refine((steps) => Object.keys(steps).length <= MAX_STEPS, `at most ${String(MAX_STEPS)} steps`)
    .optional(),
});

/** A run's summary: `ok({ summary: { code: "sync.imported", items: { new: 3, skipped: 1 }, steps: { fetch: "done" } } })`. */
export type JobRunSummary = z.output<typeof jobRunSummarySchema>;
