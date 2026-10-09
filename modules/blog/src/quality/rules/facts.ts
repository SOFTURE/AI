// The fact rules of `quality.facts` (issue #318): in every sentence of the body that quotes a rule, the
// first number must be one of the values the rule allows for the sentence's year (a year in the
// sentence, else the year of `current_as_of`).
import { isFactSentence, toFactUnit, type FactRule } from "../facts.js";
import { getProseBlocks } from "../blocks.js";
import type { QualityFinding } from "../finding.js";
import { parseNumber, splitSentences, toProse, type NumberNotation } from "../text.js";
import { isSameValue } from "./blocks.js";
import type { RuleInput } from "./input.js";

export function checkFacts({ article, blocks, settings }: RuleInput): QualityFinding[] {
  const { facts } = settings.options;
  if (facts.length === 0) return [];
  const { notation } = settings.ruleset;
  const asOfYear = Number(article.currentAsOf.slice(0, 4));
  return getProseBlocks(blocks)
    .filter((block) => block.kind !== "heading")
    .flatMap((block) =>
      splitSentences(toProse(block.text)).flatMap((sentence) =>
        facts.flatMap((rule) => {
          if (!isFactSentence(sentence, rule)) return [];
          const read = readSentence(sentence, notation);
          if (read.value === null) return [];
          const year = read.year ?? asOfYear;
          const allowed = rule.allowedValues(year) ?? [];
          if (allowed.length === 0) return [];
          const value = toFactUnit(read.value.number, rule.unit);
          if (allowed.some((candidate) => isSameValue(candidate, value))) return [];
          return [{ rule: rule.id, severity: rule.severity, message: formatMismatch(rule, read.value.raw, year, allowed), line: block.line }];
        }),
      ),
    );
}

interface SentenceValues {
  readonly value: { readonly raw: string; readonly number: number } | null;
  readonly year: number | null;
}

/** The first number of a sentence that is neither a year (1900–2100) nor a legal reference, and its first year. */
export function readSentence(sentence: string, notation: NumberNotation): SentenceValues {
  let value: SentenceValues["value"] = null;
  let year: number | null = null;
  for (const match of sentence.matchAll(new RegExp(notation.number.source, "g"))) {
    const raw = match[0];
    const before = sentence.slice(Math.max(0, match.index - 12), match.index);
    if (/[\p{L}\d]$/u.test(before) || notation.referenceBefore.test(before)) continue;
    const number = parseNumber(raw, notation);
    if (/^\d{4}$/.test(raw) && number >= 1900 && number <= 2100) {
      year ??= number;
      continue;
    }
    value ??= { raw, number };
  }
  return { value, year };
}

function formatMismatch(rule: FactRule, raw: string, year: number, allowed: readonly number[]): string {
  const unit = rule.unit === "value" ? "" : ` ${rule.unit}`;
  return `${rule.description}: ${raw} does not match the ${String(year)} value (${allowed.map(String).join(", ")}${unit})`;
}
