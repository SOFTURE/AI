// `blog({ quality })`: the gate's options, parsed at startup with the rest of the blog's options.
import { z } from "zod";
import type { BlockPlugin } from "../render/render-article.js";
import { QUALITY_SEVERITIES } from "./finding.js";
import { isQualityPlugin, type QualityPlugin } from "./plugin.js";
import { QUALITY_LANGUAGES } from "./rulesets/types.js";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isBlockPlugin(value: unknown): value is BlockPlugin {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { type?: unknown; render?: unknown };
  return typeof candidate.type === "string" && typeof candidate.render === "function";
}

function compiles(source: string): boolean {
  try {
    new RegExp(source, "giu");
    return true;
  } catch {
    // The issue message names the option; the engine's wording adds nothing for the author.
    return false;
  }
}

const range = (min: number, max: number) =>
  z
    .strictObject({ min: z.number().int().min(0).default(min), max: z.number().int().positive().default(max) })
    .prefault({})
    .refine((value) => value.min <= value.max, "min must not exceed max");

const byKind = (article: number, term: number) =>
  z.strictObject({ article: z.number().int().min(0).default(article), term: z.number().int().min(0).default(term) }).prefault({});

/** Thresholds; the defaults are FIRE's, chosen for answer-first texts that AI assistants quote. */
export const qualityLimitsSchema = z
  .strictObject({
    words: z.strictObject({ article: range(600, 4000), term: range(60, 700) }).prefault({}),
    leadWords: byKind(90, 60),
    answerWords: z.number().int().positive().default(70),
    internalLinks: byKind(2, 1),
    staleAfterDays: z.number().int().positive().default(365),
    titleChars: z.number().int().positive().default(70),
    descriptionChars: range(50, 160),
    wordsPerDash: z.number().int().positive().default(150),
    wordsPerBold: z.number().int().positive().default(200),
    sentenceWords: z.number().int().positive().default(35),
  })
  .prefault({});

const sitePath = z.string().regex(/^\/[a-z0-9/_-]*$/, "must be a path from the site root, e.g. /blog").transform((path) => (path.length > 1 ? path.replace(/\/$/, "") : path));

export const qualityOptionsSchema = z.strictObject({
  /** The ruleset of the blog's language. */
  language: z.enum(QUALITY_LANGUAGES).default("en"),
  /** Your money or your life: sources required, every significant number footnoted, no profit promises. */
  ymyl: z
    .union([z.boolean(), z.strictObject({ ownCalculationMark: z.string().trim().min(1).optional() })])
    .default(false)
    .transform((value) => (value === false ? null : { ownCalculationMark: value === true ? null : (value.ownCalculationMark ?? null) })),
  voice: z
    .strictObject({
      /** Texts signed by an editorial team: no "I", "my", "in my opinion". */
      forbidFirstPersonSingular: z.boolean().default(false),
      /** The brand's banned phrases: a regex source matched case-insensitively on word edges. */
      phrases: z
        .array(
          z.strictObject({
            id: z.string().max(60).regex(KEBAB, "kebab-case, e.g. finance-cliche"),
            pattern: z.string().min(1).refine(compiles, "must be a valid regular expression"),
            message: z.string().trim().min(1),
            severity: z.enum(QUALITY_SEVERITIES).default("error"),
          }),
        )
        .default([]),
    })
    .prefault({}),
  limits: qualityLimitsSchema,
  /** Per rule: another severity, or "off". */
  severity: z.record(z.string().regex(KEBAB), z.enum(["error", "warning", "off"])).default({}),
  /** Where the pages live; BL-4 serves them there. */
  paths: z.strictObject({ articles: sitePath.default("/blog"), terms: sitePath.default("/blog/glossary") }).prefault({}),
  /** Absolute origins whose links count as internal, besides the config's `appOrigin`. */
  ownOrigins: z.array(z.url({ protocol: /^https?$/ })).default([]),
  /** The Next.js app folder `softure-blog check` reads routes from. Default: `src/app`, else `app`. */
  appDir: z.string().trim().min(1).optional(),
  /** Route folders that are no link target (API, pages behind a login). Route groups count too, e.g. "(app)". */
  privateRouteSegments: z.array(z.string().min(1)).default(["api"]),
  plugins: z.array(z.custom<QualityPlugin>(isQualityPlugin, "must be a plugin: { name, rules, check }")).default([]),
  /** The block plugins the app renders with (`renderArticle({ blocks })`): their `requires` keys must be in the frontmatter. */
  blocks: z.array(z.custom<BlockPlugin>(isBlockPlugin, "must be a block plugin: { type, render }")).default([]),
});

export type QualityOptionsInput = z.input<typeof qualityOptionsSchema>;
export type QualityOptions = z.output<typeof qualityOptionsSchema>;
export type QualityLimits = QualityOptions["limits"];

/**
 * `blog({ quality })`: the options, or `false` to turn the gate off. Not a zod union, whose error
 * would read "Invalid input" and hide which option is wrong: the options' own issues are reported.
 * The cast gives it the types of a defaulted option: optional in, never undefined out.
 */
export const qualitySettingSchema = z
  .unknown()
  .optional()
  .transform((value, ctx): QualityOptions | false => {
    if (value === false) return false;
    const parsed = qualityOptionsSchema.safeParse(value ?? {});
    if (parsed.success) return parsed.data;
    for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    return z.NEVER;
  }) as unknown as z.ZodDefault<z.ZodType<QualityOptions | false, QualityOptionsInput | false>>;
