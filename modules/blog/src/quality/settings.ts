// The gate's resolved settings: the parsed options plus what the app config adds (its origins and time
// zone) and the blog's image policy, with the ruleset and voice patterns compiled once.
import type { SoftureConfig } from "@softure-ai/core";
import type { ArticleImagePolicy } from "../render/images.js";
import type { QualitySeverity } from "./finding.js";
import type { QualityOptions } from "./options.js";
import { QUALITY_RULESETS } from "./rulesets/index.js";
import type { LanguageRuleset, StylePattern } from "./rulesets/types.js";

export interface QualitySettings {
  readonly options: QualityOptions;
  readonly ruleset: LanguageRuleset;
  /** The app's voice phrases plus, when switched on, the ruleset's first person singular. */
  readonly voicePatterns: readonly StylePattern[];
  /** Origins whose absolute links are internal: the app's `appOrigin`, the site origin and `ownOrigins`. */
  readonly ownOrigins: readonly string[];
  /** IANA time zone of "today". */
  readonly timeZone: string;
  /** The app's image policy (`blog({ images })`); `null` when bodies may show no image. */
  readonly images: ArticleImagePolicy | null;
  /** Where articles and terms live: `options.paths` where set, else the blog's routes. */
  readonly paths: QualityPaths;
}

export interface QualityPaths {
  readonly articles: string;
  readonly terms: string;
}

/** The paths a caller without the blog's routes gets: the module's default routes. */
const DEFAULT_PATHS: QualityPaths = { articles: "/blog", terms: "/blog/glossary" };

export function resolveQualitySettings(
  options: QualityOptions,
  config: Pick<SoftureConfig, "appOrigin" | "timezone"> & {
    /** The canonical site origin (core's `getSiteUrls(config).origin`) when it is not `appOrigin`. */
    readonly siteOrigin?: string;
    /** The blog's routes (`getBlogRoutes`), the source of `paths` unless `options.paths` overrides them. */
    readonly routes?: { readonly index: string; readonly glossary: string };
  },
  images: ArticleImagePolicy | null = null,
): QualitySettings {
  const ruleset = QUALITY_RULESETS[options.language];
  const voicePatterns: StylePattern[] = options.voice.phrases.map((phrase) => ({
    id: phrase.id,
    severity: phrase.severity,
    pattern: phrase.pattern,
    message: phrase.message,
  }));
  if (options.voice.forbidFirstPersonSingular) {
    voicePatterns.push({
      id: "first-person-singular",
      severity: "error",
      pattern: ruleset.firstPersonSingular,
      message: "first person singular; the texts are signed by the editors (\"we\", \"you\"), never \"I\"",
    });
  }
  const origins = [config.appOrigin, ...(config.siteOrigin === undefined ? [] : [config.siteOrigin]), ...options.ownOrigins].map((origin) => new URL(origin).origin);
  const paths: QualityPaths = {
    articles: options.paths.articles ?? config.routes?.index ?? DEFAULT_PATHS.articles,
    terms: options.paths.terms ?? config.routes?.glossary ?? DEFAULT_PATHS.terms,
  };
  return { options, ruleset, voicePatterns, ownOrigins: [...new Set(origins)], timeZone: config.timezone, images, paths };
}

/** `YYYY-MM-DD` of a moment in a time zone. */
export function getLocalDate(moment: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
}

/** The severity a finding of `rule` gets: the override, else its own; `null` for "off". */
export function getEffectiveSeverity(settings: QualitySettings, rule: string, severity: QualitySeverity): QualitySeverity | null {
  const override = settings.options.severity[rule];
  if (override === undefined) return severity;
  return override === "off" ? null : override;
}
