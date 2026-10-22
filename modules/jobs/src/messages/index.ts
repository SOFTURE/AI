import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const jobsMessages = { en };

export type JobsMessages = typeof en;

/** The namespaces whose codes `errors` has copy for, keyed by the code's name (`jobs.not_found` → `not_found`). */
const COPY_NAMESPACES = new Set(["jobs", "auth", "core"]);

/** The copy for an error code of the admin page's actions; an unknown code gets the generic failure. */
export function getJobsErrorMessage(messages: JobsMessages, code: string): string {
  const separator = code.lastIndexOf(".");
  const namespace = code.slice(0, separator);
  const name = code.slice(separator + 1);
  const errors = messages.errors as Readonly<Record<string, string>>;
  return (COPY_NAMESPACES.has(namespace) && Object.hasOwn(errors, name) ? errors[name] : undefined) ?? messages.errors.unexpected;
}
