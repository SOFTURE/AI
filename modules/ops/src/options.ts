// The options an app passes to `ops({ ... })` in softure.config.ts, parsed at startup.
import type { HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { z } from "zod";

const CHECK_NAME = /^[a-z][a-z0-9_.-]{0,62}$/;
const CHECK_NAME_HINT = "is not a check name: lowercase letters, digits, _ . and -, starting with a letter";
const CHECK_HINT = "must be a function (context) => Promise<Result<undefined>>";
const GET_DATABASE_HINT = "must be a function () => Promise<Queryable>, e.g. the app's own getDatabase";

export const opsOptionsSchema = z.strictObject({
  /**
   * The app's own checks, by name, run after the database and the module checks. A name must not
   * be `database` or the id of an enabled module that contributes a check (checked at the request).
   */
  checks: z
    .record(z.string(), z.custom<HealthCheck>((value) => typeof value === "function", CHECK_HINT))
    .superRefine((checks, context) => {
      for (const name of Object.keys(checks).filter((candidate) => !CHECK_NAME.test(candidate))) {
        context.addIssue({ code: "custom", path: [name], message: CHECK_NAME_HINT });
      }
    })
    .default({}),
  /** How long one check may run before it counts as `timed_out`. */
  timeoutMs: z.number().int().min(100).max(30_000).default(3_000),
  /**
   * What the public response shows: `status` only (the default: a stranger learns nothing about
   * the app), or `checks` too, with each check's name and state.
   */
  detail: z.enum(["status", "checks"]).default("status"),
  /**
   * Whether a config without a database fails the health route. On by default: apps build `database` from
   * `DATABASE_URL` and get `null` when it is unset, and a route that checked nothing would answer 200. An app that
   * really has no database sets `false`.
   */
  requireDatabase: z.boolean().default(true),
  /**
   * The database the health route checks, when it should be neither the config's `database.handle` nor the
   * small pool the route opens from `database.url` for Postgres. A `pglite://` URL or a `database.handle`
   * already resolves to the process's one handle, so this is rarely needed.
   */
  getDatabase: z
    .custom<() => Promise<Queryable>>((value) => typeof value === "function", GET_DATABASE_HINT)
    .optional(),
});

export type OpsOptionsInput = z.input<typeof opsOptionsSchema>;
export type OpsOptions = z.output<typeof opsOptionsSchema>;
