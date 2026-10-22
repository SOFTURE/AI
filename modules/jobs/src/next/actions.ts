"use server";

// The admin page's server actions. The role is checked first, through the app's `panelGuard`, before the form is read
// (never from a bound argument, which the client controls, docs/02 §8); without a guard every action is refused.
// Unexpected failures become `safeError` codes, logged by kind only. A change revalidates the page route.
import { errorLogLabel, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobsFormState } from "../contract.js";
import { cancelJob, retryJob } from "../server/admin.js";
import { getJobsOptions, getJobsRoutes } from "../server/options.js";
import { runScheduleNow } from "../server/schedules.js";
import { retrySyncItem } from "../server/sync-items.js";
import { getJobsContext } from "./context.js";

/** Longer than any id, queue or source the module accepts, so a cut value can never match a real one. */
const MAX_FIELD_LENGTH = 501;

const field = z
  .string()
  .catch("")
  .transform((value) => value.slice(0, MAX_FIELD_LENGTH));

const FORBIDDEN: JobsFormState = { status: "error", error: "auth.forbidden" };

/** True when the app's guard lets the signed-in user hold the panel role. */
async function isAuthorized(config: SoftureConfig): Promise<boolean> {
  const options = getJobsOptions(config);
  if (options.panelGuard === undefined) return false;
  return (await options.panelGuard.authorizeRole(options.panelRole)).ok;
}

/** Runs one steering call for an authorized caller and turns its outcome into the form's state. */
async function steer(operation: string, run: (config: SoftureConfig) => Promise<JobsFormState>): Promise<JobsFormState> {
  const config = getSoftureConfig();
  if (!(await isAuthorized(config))) return FORBIDDEN;
  let state: JobsFormState;
  try {
    state = await run(config);
  } catch (error) {
    console.error(`@softure-ai/jobs: ${operation} failed: ${errorLogLabel(error)}`);
    return { status: "error", error: safeError(error).error };
  }
  // Outside the try: the change is stored, so a revalidation failure must not report it as failed.
  if (state.status === "ok") revalidatePath(getJobsRoutes(config).panel);
  return state;
}

/** Enqueues a run of a schedule now (joining a pending one). */
export async function runScheduleNowAction(_previous: JobsFormState, formData: FormData): Promise<JobsFormState> {
  return steer("running a schedule now", async (config) => {
    const result = await runScheduleNow(await getJobsContext(config), field.parse(formData.get("queue")));
    if (!result.ok) return { status: "error", error: result.error };
    return { status: "ok", notice: result.value.isDuplicate ? "run_joined" : "run_enqueued" };
  });
}

/** Runs a failed or cancelled job again from scratch. */
export async function retryJobAction(_previous: JobsFormState, formData: FormData): Promise<JobsFormState> {
  return steer("retrying a job", async (config) => {
    const result = await retryJob(await getJobsContext(config), field.parse(formData.get("id")));
    return result.ok ? { status: "ok" } : { status: "error", error: result.error };
  });
}

/** Cancels a pending job (one waiting for its retry included). */
export async function cancelJobAction(_previous: JobsFormState, formData: FormData): Promise<JobsFormState> {
  return steer("cancelling a job", async (config) => {
    const result = await cancelJob(await getJobsContext(config), field.parse(formData.get("id")));
    return result.ok ? { status: "ok" } : { status: "error", error: result.error };
  });
}

/** Puts a failed sync ledger item back to pending. */
export async function retrySyncItemAction(_previous: JobsFormState, formData: FormData): Promise<JobsFormState> {
  return steer("retrying a sync item", async (config) => {
    const input = { source: field.parse(formData.get("source")), itemId: field.parse(formData.get("itemId")) };
    const result = await retrySyncItem(await getJobsContext(config), input);
    return result.ok ? { status: "ok" } : { status: "error", error: result.error };
  });
}
