// The shape of a language ruleset: the language data the style, voice and YMYL rules match against.
import type { QualitySeverity } from "../finding.js";
import type { NumberNotation } from "../text.js";

export const QUALITY_LANGUAGES = ["en", "pl"] as const;
export type QualityLanguage = (typeof QUALITY_LANGUAGES)[number];

export interface StylePattern {
  /** The rule id; the same id in two rulesets names the same habit. */
  readonly id: string;
  readonly severity: QualitySeverity;
  /** Global, so every hit counts. */
  readonly pattern: RegExp;
  /** What is wrong and what to write instead. */
  readonly message: string;
}

export interface LanguageRuleset {
  readonly language: QualityLanguage;
  /** AI-writing and generic style patterns. Errors: one hit is enough. Warnings: reported once per rule with a count. */
  readonly patterns: readonly StylePattern[];
  /** First person singular, for apps whose texts are signed by an editorial team (`voice.forbidFirstPersonSingular`). */
  readonly firstPersonSingular: RegExp;
  /** Promises of profit and orders to buy (YMYL). */
  readonly profitPromises: RegExp;
  readonly notation: NumberNotation;
  /** An enumeration of three ("a, b and c"); more than three in a text reads as a template. */
  readonly triad: RegExp;
  /** Whether Title Case Headings are a mistake in this language. */
  readonly flagsTitleCaseHeadings: boolean;
}
