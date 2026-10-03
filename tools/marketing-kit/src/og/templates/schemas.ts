import { z } from "zod";

/**
 * The `data` of each template, the contract `marketing.json` and a Next route both fill. Limits are
 * what a 1200×630 card has room for: longer copy would overflow silently.
 */

const line = (max: number) =>
  z
    .string()
    .max(max, `must be at most ${max} characters`)
    .refine((value) => value.trim().length > 0, "must not be blank");

/** Only the characters of SVG path data: no markup can reach the image. */
const PATH_DATA_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/;

const tileSchema = z.strictObject({ label: line(24), value: line(16) });

export const CHART_TONES = ["accent", "cta", "foreground", "muted"] as const;

export type ChartTone = (typeof CHART_TONES)[number];

export const headlineCtaDataSchema = z.strictObject({
  eyebrow: line(40).optional(),
  headline: line(90),
  /** The call to action, drawn as a pill at the bottom. */
  cta: line(32).optional(),
  tiles: z.array(tileSchema).max(4, "at most four tiles fit").default([]),
});

export const headlineChartDataSchema = z.strictObject({
  eyebrow: line(40).optional(),
  headline: line(90),
  /** A chart the app computed: paths in the coordinates of `viewBox` ([width, height]). */
  chart: z.strictObject({
    viewBox: z.tuple([z.number().positive(), z.number().positive()]),
    paths: z
      .array(
        z.strictObject({
          d: z.string().min(1).max(20_000).regex(PATH_DATA_PATTERN, "must be SVG path data (commands and numbers only)"),
          tone: z.enum(CHART_TONES).default("accent"),
          /** Fills the shape with a light tint of the tone instead of stroking the line. */
          fill: z.boolean().default(false),
          /** Line width in `viewBox` units; by default a hundredth of the view box's width. */
          strokeWidth: z.number().positive().optional(),
        }),
      )
      .min(1, "a chart needs at least one path")
      .max(8, "at most eight paths"),
  }),
  tiles: z.array(tileSchema).max(3, "at most three tiles fit").default([]),
});

export type HeadlineCtaData = z.output<typeof headlineCtaDataSchema>;
export type HeadlineChartData = z.output<typeof headlineChartDataSchema>;
