// The options an app passes to `analytics({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import type { AnalyticsContext } from "./server/funnel.js";

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

/**
 * How a raw value is repaired before the pattern check: `none` takes it as it is; `trim-lowercase`
 * trims whitespace and lowercases it, so `?z=Newsletter` from an old link counts as `newsletter`.
 */
export const CHANNEL_NORMALIZATIONS = ["none", "trim-lowercase"] as const;
export type ChannelNormalization = (typeof CHANNEL_NORMALIZATIONS)[number];

/** A field name of the funnel's wire format (`step`, `k`, `z`): short, lowercase, URL-safe. */
const fieldNameSchema = z.string().regex(PARAM_PATTERN, "must be lowercase letters, digits, - or _, starting with a letter, at most 32 characters");

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
  /** How a raw value is repaired before the pattern and length checks; the browser keeper does the same. */
  normalize: z.enum(CHANNEL_NORMALIZATIONS).default("none"),
});

/**
 * Whether the app already knows `channel` from its own tables (a sign-up or an account attributed to
 * it), so the daily cap on new channels never folds it into the overflow key. `ctx` is the counter's
 * context: `ctx.db` runs in the counting transaction.
 */
export type IsKnownChannel = (channel: string, ctx: AnalyticsContext) => boolean | Promise<boolean>;

/** A channel derived from the path of the page a funnel request came from, when the page carries no tag. */
export type ChannelFromReferer = (page: URL) => string | null;

/**
 * The funnel's wire format: the field names a beacon body or a pixel query uses. Pages cached with an
 * older format keep sending it, so the endpoint accepts every name in `stepFields`; the package's
 * own beacon and pixel send the first.
 */
const wireSchema = z
  .strictObject({
    /** The fields that name the step, e.g. `["step", "k"]`; the first is sent. A request naming the step twice counts nothing. */
    stepFields: z.array(fieldNameSchema).min(1, "needs at least one field").max(4, "takes at most 4 fields").default(["step"]),
    /**
     * A field of the beacon body or pixel query that carries the channel (`"z"`), for pages that send it
     * themselves; `null` (the default): only the page the request came from decides. A valid value
     * wins over the page's; an invalid one is ignored.
     */
    channelField: fieldNameSchema.nullable().default(null),
  })
  .superRefine((wire, context) => {
    wire.stepFields.forEach((field, index) => {
      if (wire.stepFields.indexOf(field) !== index) context.addIssue({ code: "custom", path: ["stepFields", index], message: `"${field}" is listed twice` });
    });
    if (wire.channelField !== null && wire.stepFields.includes(wire.channelField)) {
      context.addIssue({ code: "custom", path: ["channelField"], message: `"${wire.channelField}" already names the step` });
    }
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
    wire: wireSchema.prefault({}),
    /**
     * The channel of a beacon or pixel sent from a page without a tag, derived from the page's URL:
     * `(page) => (page.pathname.startsWith("/blog/") ? "blog" : null)`. Its result passes the channel
     * rule like any tag; a throw counts as no channel.
     */
    channelFromReferer: z.custom<ChannelFromReferer>((value) => typeof value === "function", "must be a function (page: URL) => string | null").optional(),
    /**
     * A channel the app knows from its own tables counts under its name past the daily cap:
     * `(channel, ctx) => hasSignupsFrom(ctx.db, channel)`. Asked for every count with a channel, so
     * keep it to one indexed lookup; a throw fails the count like a database error.
     */
    isKnownChannel: z.custom<IsKnownChannel>((value) => typeof value === "function", "must be a function (channel, ctx) => boolean | Promise<boolean>").optional(),
  })
  .superRefine((options, context) => {
    const seen = new Set<string>();
    options.steps.forEach((step, index) => {
      if (seen.has(step.id)) context.addIssue({ code: "custom", path: ["steps", index, "id"], message: `"${step.id}" is listed twice` });
      seen.add(step.id);
    });
  });

/** An extra first-party origin: an http(s) URL with nothing after the host, reduced to its origin. */
const originSchema = z
  .string()
  .refine((value) => isBareOrigin(value), "must be an http(s) origin such as https://example.com, without a path, query or credentials")
  .transform((value) => new URL(value).origin);

export const analyticsOptionsSchema = z.strictObject({
  /**
   * The app's first-party origins besides `appOrigin`, e.g. a public site on the apex when the product
   * runs on a subdomain. A tag from a page on any of them is read, the funnel counts their pages, and
   * the proxy piece redirects on the one the request was sent to.
   */
  origins: z.array(originSchema).max(16, "takes at most 16 origins").default([]),
  channel: channelOptionsSchema.prefault({}),
  funnel: funnelOptionsSchema.prefault({}),
});

function isBareOrigin(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.username === "" && url.password === "" && (url.pathname === "/" || url.pathname === "") && url.search === "" && url.hash === "" && !value.includes("?") && !value.includes("#");
}

export type AnalyticsOptions = z.output<typeof analyticsOptionsSchema>;
export type AnalyticsOptionsInput = z.input<typeof analyticsOptionsSchema>;
export type ChannelOptions = AnalyticsOptions["channel"];
export type FunnelOptions = AnalyticsOptions["funnel"];
export type FunnelStep = FunnelOptions["steps"][number];
export type FunnelWire = FunnelOptions["wire"];
