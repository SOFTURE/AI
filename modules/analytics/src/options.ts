// The options an app passes to `analytics({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";

/** The query parameter's name: short, lowercase, URL-safe. */
export const PARAM_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
/** Channel values by default: lowercase words joined by single dashes or underscores. */
export const DEFAULT_CHANNEL_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
/** The longest channel value any configuration accepts (it becomes a counter key in the funnel). */
export const MAX_CHANNEL_LENGTH = 64;

/**
 * The funnel counts new channels past the daily cap under this key. `~` starts it, so it is never a
 * valid channel: the options refuse a pattern that would accept it.
 */
export const OVERFLOW_CHANNEL = "~overflow";
/** Step ids: kebab-case, at most 32 characters (the table checks the same shape). */
export const STEP_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const MAX_STEP_LENGTH = 32;
/** The most steps one funnel has. */
export const MAX_STEPS = 32;
/** The default number of distinct new channels a day counts under their own name. */
export const DEFAULT_CHANNEL_CAP = 100;

const channelOptionsSchema = z.strictObject({
  /** The query parameter that carries the channel, e.g. `?z=newsletter`. */
  param: z.string().regex(PARAM_PATTERN, "must be lowercase letters, digits, - or _, starting with a letter, at most 32 characters").default("z"),
  /** What a valid value looks like; anything else is ignored. */
  pattern: z
    .instanceof(RegExp, { message: "must be a RegExp" })
    // A global or sticky RegExp keeps `lastIndex` between tests, so the same value would pass, then fail.
    .refine((pattern) => !pattern.global && !pattern.sticky, "must not use the g or y flag")
    .refine((pattern) => pattern.global || pattern.sticky || !pattern.test(OVERFLOW_CHANNEL), `must not accept "${OVERFLOW_CHANNEL}", the funnel's overflow key`)
    .default(DEFAULT_CHANNEL_PATTERN),
  /** The longest value accepted; longer ones are ignored, never cut. */
  maxLength: z
    .number()
    .int()
    .min(1)
    .max(MAX_CHANNEL_LENGTH, `must be at most ${String(MAX_CHANNEL_LENGTH)}`)
    .default(32),
});

/**
 * How a step is counted:
 * - `beacon`: the browser posts it (`<FunnelBeacon>`, `createFunnelReporter`), e.g. a wizard step;
 * - `pixel`: an image on a page requests it (`<FunnelPixel>`), counting a page view without JavaScript;
 * - `server`: only the app's server code counts it (`recordFunnelStep`, `countRegistration`), e.g. a
 *   sign-up. The public endpoint refuses these, so nobody outside can inflate them.
 */
export const FUNNEL_STEP_SOURCES = ["beacon", "pixel", "server"] as const;
export type FunnelStepSource = (typeof FUNNEL_STEP_SOURCES)[number];

const stepSchema = z.strictObject({
  /** The step's id, kept when steps are reordered: a count stored under it keeps its meaning. */
  id: z.string().max(MAX_STEP_LENGTH, `must be at most ${String(MAX_STEP_LENGTH)} characters`).regex(STEP_PATTERN, "must be kebab-case, e.g. pricing-page"),
  via: z.enum(FUNNEL_STEP_SOURCES).default("beacon"),
});

const funnelOptionsSchema = z
  .strictObject({
    /** The funnel's steps in the order a visitor reaches them; the report keeps this order. */
    steps: z.array(stepSchema).max(MAX_STEPS, `takes at most ${String(MAX_STEPS)} steps`).default([]),
    /**
     * Distinct new channels a day counted under their own name. Channels past it count under
     * `OVERFLOW_CHANNEL`, so a flood of made-up tags cannot grow the table; a channel already
     * counted on an earlier day is never capped.
     */
    channelCap: z.number().int().min(1).max(10_000).default(DEFAULT_CHANNEL_CAP),
  })
  .superRefine((options, context) => {
    const seen = new Set<string>();
    options.steps.forEach((step, index) => {
      if (seen.has(step.id)) context.addIssue({ code: "custom", path: ["steps", index, "id"], message: `"${step.id}" is listed twice` });
      seen.add(step.id);
    });
  });

export const analyticsOptionsSchema = z.strictObject({
  channel: channelOptionsSchema.prefault({}),
  funnel: funnelOptionsSchema.prefault({}),
});

export type AnalyticsOptions = z.output<typeof analyticsOptionsSchema>;
export type AnalyticsOptionsInput = z.input<typeof analyticsOptionsSchema>;
export type ChannelOptions = AnalyticsOptions["channel"];
export type FunnelOptions = AnalyticsOptions["funnel"];
export type FunnelStep = FunnelOptions["steps"][number];
