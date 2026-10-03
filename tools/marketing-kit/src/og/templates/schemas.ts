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

const tileSchema = z.strictObject({
  label: line(24).describe("The tile's caption, at most 24 characters."),
  value: line(16).describe("The tile's value, at most 16 characters."),
});

export const CHART_TONES = ["accent", "cta", "foreground", "muted"] as const;

export type ChartTone = (typeof CHART_TONES)[number];

const eyebrow = line(40).optional().describe("A short line above the headline, at most 40 characters.");
const headline = line(90).describe("The card's headline, at most 90 characters.");

export const headlineCtaDataSchema = z.strictObject({
  eyebrow,
  headline,
  cta: line(32).optional().describe("The call to action, drawn as a pill in the cta colours at the bottom; at most 32 characters."),
  tiles: z.array(tileSchema).max(4, "at most four tiles fit").default([]).describe("Up to four label and value tiles."),
});

export const headlineChartDataSchema = z.strictObject({
  eyebrow,
  headline,
  chart: z
    .strictObject({
      viewBox: z.tuple([z.number().positive(), z.number().positive()]).describe("The coordinate space of the paths, [width, height]."),
      paths: z
        .array(
          z.strictObject({
            d: z
              .string()
              .min(1)
              .max(20_000)
              .regex(PATH_DATA_PATTERN, "must be SVG path data (commands and numbers only)")
              .describe("SVG path data in viewBox coordinates (commands and numbers only)."),
            tone: z.enum(CHART_TONES).default("accent").describe("The brand colour role the path is drawn in."),
            fill: z.boolean().default(false).describe("Fills the shape with a light tint of the tone instead of stroking the line."),
            strokeWidth: z.number().positive().optional().describe("Line width in viewBox units; by default a hundredth of the view box's width."),
          }),
        )
        .min(1, "a chart needs at least one path")
        .max(8, "at most eight paths")
        .describe("The chart's paths, one to eight, drawn in order."),
    })
    .describe("A chart the app computed: paths in the coordinates of viewBox."),
  tiles: z.array(tileSchema).max(3, "at most three tiles fit").default([]).describe("Up to three label and value tiles."),
});

export type HeadlineCtaData = z.output<typeof headlineCtaDataSchema>;
export type HeadlineChartData = z.output<typeof headlineChartDataSchema>;
