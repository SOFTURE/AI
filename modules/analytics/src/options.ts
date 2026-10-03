// The options an app passes to `analytics({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";

/** The query parameter's name: short, lowercase, URL-safe. */
export const PARAM_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
/** Channel values by default: lowercase words joined by single dashes or underscores. */
export const DEFAULT_CHANNEL_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
/** The longest channel value any configuration accepts (it becomes a counter key in the funnel). */
export const MAX_CHANNEL_LENGTH = 64;

const channelOptionsSchema = z.strictObject({
  /** The query parameter that carries the channel, e.g. `?z=newsletter`. */
  param: z.string().regex(PARAM_PATTERN, "must be lowercase letters, digits, - or _, starting with a letter, at most 32 characters").default("z"),
  /** What a valid value looks like; anything else is ignored. */
  pattern: z
    .instanceof(RegExp, { message: "must be a RegExp" })
    // A global or sticky RegExp keeps `lastIndex` between tests, so the same value would pass, then fail.
    .refine((pattern) => !pattern.global && !pattern.sticky, "must not use the g or y flag")
    .default(DEFAULT_CHANNEL_PATTERN),
  /** The longest value accepted; longer ones are ignored, never cut. */
  maxLength: z
    .number()
    .int()
    .min(1)
    .max(MAX_CHANNEL_LENGTH, `must be at most ${String(MAX_CHANNEL_LENGTH)}`)
    .default(32),
});

export const analyticsOptionsSchema = z.strictObject({
  channel: channelOptionsSchema.prefault({}),
});

export type AnalyticsOptions = z.output<typeof analyticsOptionsSchema>;
export type AnalyticsOptionsInput = z.input<typeof analyticsOptionsSchema>;
export type ChannelOptions = AnalyticsOptions["channel"];
