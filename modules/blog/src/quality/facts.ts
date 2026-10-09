// Fact rules (issue #318): a value a text quotes that the app knows for each year, such as a yearly
// contribution limit or a tax rate. A sentence that matches a rule's pattern quotes the value as its
// first number; the gate compares it with the values of the sentence's year, and `softure-blog refresh`
// lists the texts that quote a value which changed after their `current_as_of`.
import { z } from "zod";
import { QUALITY_SEVERITIES } from "./finding.js";

/** How the allowed values relate to the number in the text: as written, or in hundredths (cents, basis points). */
export const FACT_UNITS = ["value", "cents", "bps"] as const;
export type FactUnit = (typeof FACT_UNITS)[number];

/** When the rule's value changes: on 1 January, on the first day of each quarter, or never. */
export const FACT_EXPIRIES = ["yearly", "quarterly", "never"] as const;
export type FactExpiry = (typeof FACT_EXPIRIES)[number];

/** The values allowed in a year; nothing (or an empty list) leaves a sentence about that year unchecked. */
export type FactValues = (year: number) => readonly number[] | undefined;

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const factRuleSchema = z.strictObject({
  /** The rule id in findings, in `quality.severity` and in the writing skill. */
  id: z.string().max(60).regex(KEBAB, "kebab-case, e.g. ike-limit"),
  /** What the value is, e.g. "the yearly IKE contribution limit". */
  description: z.string().trim().min(1),
  /** Keywords of a sentence that quotes the value; matched with `String.search`, so a `g` flag does no harm. */
  patterns: z.array(z.instanceof(RegExp, { error: "must be a regular expression" })).min(1, "needs at least one pattern"),
  allowedValues: z.custom<FactValues>((value) => typeof value === "function", "must be a function (year) => number[]"),
  /** `"cents"` and `"bps"`: the allowed values are hundredths of the number in the text (an amount in cents, a percentage in basis points). */
  unit: z.enum(FACT_UNITS).default("value"),
  expires: z.enum(FACT_EXPIRIES).default("never"),
  severity: z.enum(QUALITY_SEVERITIES).default("error"),
});

export type FactRuleInput = z.input<typeof factRuleSchema>;
export type FactRule = z.output<typeof factRuleSchema>;

/** Types a fact rule for `blog({ quality: { facts } })`; the options validate it at startup. */
export function factRule(input: FactRuleInput): FactRuleInput {
  return input;
}

/** The text's number in the rule's unit: hundredths for cents and basis points, rounded off binary noise. */
export function toFactUnit(value: number, unit: FactUnit): number {
  return unit === "value" ? value : Math.round(value * 100 * 1e6) / 1e6;
}

/** Whether a sentence quotes the rule. */
export function isFactSentence(sentence: string, rule: Pick<FactRule, "patterns">): boolean {
  return rule.patterns.some((pattern) => sentence.search(pattern) !== -1);
}

/** The day the value of a rule last changed on or before `today` (`YYYY-MM-DD`); `null` for a rule that never expires. */
export function getFactChangeDay(today: string, expires: FactExpiry): string | null {
  if (expires === "never") return null;
  const year = today.slice(0, 4);
  if (expires === "yearly") return `${year}-01-01`;
  const month = Number(today.slice(5, 7));
  const quarterStart = Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${String(quarterStart).padStart(2, "0")}-01`;
}
