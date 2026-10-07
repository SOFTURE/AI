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

/*
 * The portrait templates are written for a 1080×1350 post and scale by the limiting side, so their limits hold at
 * every size: copy at the limits stays inside the frame (tests/og/portrait-fit.test.ts renders it and checks).
 */

const source = line(80).optional().describe('Where the figures come from, drawn small at the bottom, e.g. "Source: ZUS, 2026"; at most 80 characters.');
const portraitCta = line(32).optional().describe("A call to action, drawn as a pill in the cta colours at the bottom; at most 32 characters.");

export const bigNumberDataSchema = z.strictObject({
  eyebrow,
  number: line(12).describe('The figure that fills the post, unit included, e.g. "898 PLN"; at most 12 characters. Shorter numbers get bigger type.'),
  caption: line(90).describe("The sentence that says what the number is, under it; at most 90 characters."),
  tiles: z.array(tileSchema).max(2, "at most two tiles fit").default([]).describe("Up to two label and value tiles under the caption, e.g. a second figure."),
  cta: portraitCta,
  source,
});

const slideSchema = z.strictObject({
  eyebrow,
  headline: line(90).describe("The slide's headline, at most 90 characters."),
  body: line(200).optional().describe("A paragraph under the headline, at most 200 characters."),
  tiles: z.array(tileSchema).max(2, "at most two tiles fit").default([]).describe("Up to two label and value tiles side by side."),
  cta: portraitCta,
  source,
});

export const carouselDataSchema = z.strictObject({
  slides: z.array(slideSchema).min(2, "a carousel needs at least two slides").max(10, "at most ten slides").describe("The slides in order, two to ten; each renders to its own file <id>-<n>.png."),
  counter: z.boolean().default(true).describe('Draws "n/N" in the top corner of every slide.'),
});

export type BigNumberData = z.output<typeof bigNumberDataSchema>;
export type CarouselData = z.output<typeof carouselDataSchema>;
export type CarouselSlide = CarouselData["slides"][number];
