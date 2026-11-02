// The alerts options as `alerts({ ... })` takes them, validated with zod at config load.
import type { Err, ErrorCode, Ok } from "@softure-ai/core";
import { z } from "zod";
import type { AlertChannel, DeliverAlert } from "./channels.js";
import { ALERT_SEVERITIES } from "./contract.js";
import { quietHoursSchema } from "./quiet-hours.js";

const DAY_SECONDS = 24 * 60 * 60;
/** A channel name: lowercase letters, digits, `_` and `-`, starting with a letter, up to 40 characters. */
export const CHANNEL_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;

/** The role check of the admin page, from `@softure-ai/auth/next`. */
export interface AlertsPanelGuard {
  readonly requireRole: (role: string) => Promise<unknown>;
  readonly authorizeRole: (role: string) => Promise<Ok<unknown> | Err<ErrorCode>>;
}

function isPanelGuard(value: unknown): value is AlertsPanelGuard {
  if (typeof value !== "object" || value === null) return false;
  const guard = value as Partial<Record<keyof AlertsPanelGuard, unknown>>;
  return typeof guard.requireRole === "function" && typeof guard.authorizeRole === "function";
}

const channelSchema = z.object({
  kind: z.string().min(1).max(40),
  deliver: z.custom<DeliverAlert>((value) => typeof value === "function", "must be a function (build the channel with slackChannel(), mailChannel() or defineAlertChannel())"),
  minSeverity: z.enum(ALERT_SEVERITIES).default("info"),
  quietHours: quietHoursSchema.optional(),
});

export const alertsOptionsSchema = z.strictObject({
  /** Named channels, e.g. `{ ops: slackChannel({ url }), mail: mailChannel({ to }) }`; every alert goes to each. */
  channels: z.record(z.string(), channelSchema).superRefine((channels, context) => {
    const names = Object.keys(channels);
    if (names.length === 0) context.addIssue({ code: "custom", message: "must name at least one channel" });
    for (const name of names.filter((candidate) => !CHANNEL_NAME_PATTERN.test(candidate))) {
      context.addIssue({ code: "custom", path: [name], message: "a channel name must be lowercase letters, digits, _ and -, starting with a letter" });
    }
  }),
  /** While an alert fires, repeats within this many seconds after the last message are counted, not sent. */
  repeatWindowSeconds: z.number().int().min(60).max(7 * DAY_SECONDS).default(60 * 60),
  /** Days a resolved alert stays in the list before the flush job deletes it. */
  retentionDays: z.number().int().min(1).max(365).default(30),
  /** The auth role that may open the admin page. */
  panelRole: z.string().min(1).default("admin"),
  panelGuard: z.custom<AlertsPanelGuard>(isPanelGuard, "must be { requireRole, authorizeRole } from @softure-ai/auth/next").optional(),
});

export type AlertsOptionsInput = z.input<typeof alertsOptionsSchema> & { readonly channels: Readonly<Record<string, AlertChannel>> };
export type AlertsOptions = z.output<typeof alertsOptionsSchema>;
export type ConfiguredChannel = AlertsOptions["channels"][string];
