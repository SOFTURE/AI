// The fact rules of `quality.facts` (issues #318, #379): in every sentence of the body that quotes a rule,
// the value (the first number of a pattern's group 1, else the first number of the sentence)
// must be one of the values the rule allows for a year the sentence names (else the year of
// `current_as_of`). A sentence none of whose years has values passes, or warns with `onUnknownYear: "warn"`.
import { isFactSentence, toFactUnit, type FactRule } from "../facts.js";
import { getProseBlocks } from "../blocks.js";
import type { QualityFinding } from "../finding.js";
import { parseNumber, splitSentences, toProse, type NumberNotation } from "../text.js";
import { isSameValue } from "./blocks.js";
import type { RuleInput } from "./input.js";

interface QuotedValue {
  readonly raw: string;
  readonly number: number;
}

interface YearValues {
  readonly year: number;
  readonly values: readonly number[];
}

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
          const finding = checkSentence(sentence, rule, { notation, asOfYear });
          return finding === null ? [] : [{ ...finding, line: block.line }];
        }),
      ),
    );
}

function checkSentence(
  sentence: string,
  rule: FactRule,
  { notation, asOfYear }: { notation: NumberNotation; asOfYear: number },
): Omit<QualityFinding, "line"> | null {
  if (!isFactSentence(sentence, rule)) return null;
  const value = readFactValue(sentence, rule, notation);
  if (value === null) return null;
  const { years } = readSentence(sentence, notation);
  const named = years.length > 0 ? years : [asOfYear];
  const known = named.flatMap((year): YearValues[] => {
    const values = rule.allowedValues(year) ?? [];
    return values.length === 0 ? [] : [{ year, values }];
  });
  if (known.length === 0) {
    if (rule.onUnknownYear === "skip") return null;
    return { rule: rule.id, severity: "warning", message: `${rule.description}: no value known for ${named.map(String).join(", ")}, ${value.raw} not checked` };
  }
  const number = toFactUnit(value.number, rule.unit);
  if (known.some(({ values }) => values.some((candidate) => isSameValue(candidate, number)))) return null;
  return { rule: rule.id, severity: rule.severity, message: formatMismatch(rule, value.raw, known) };
}

/**
 * The value a sentence quotes for a rule: the first number of group 1 of the first matching pattern whose
 * group 1 holds one, else the first number of the sentence (a group used only to group keywords, like
 * `(of|for)`, changes nothing); `null` for none.
 */
export function readFactValue(sentence: string, rule: Pick<FactRule, "patterns">, notation: NumberNotation): QuotedValue | null {
  for (const pattern of rule.patterns) {
    const group = toOneShot(pattern).exec(sentence)?.[1];
    const value = group === undefined ? null : readSentence(group, notation).value;
    if (value !== null) return value;
  }
  return readSentence(sentence, notation).value;
}

/** A copy without `g` and `y`, so `exec` starts at 0 and the app's regular expression keeps its `lastIndex`. */
function toOneShot(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""));
}

interface SentenceValues {
  readonly value: QuotedValue | null;
  readonly years: readonly number[];
}

/** The first number of a sentence that is neither a year (1900–2100) nor a legal reference, and its distinct years in order. */
export function readSentence(sentence: string, notation: NumberNotation): SentenceValues {
  let value: QuotedValue | null = null;
  const years: number[] = [];
  for (const match of sentence.matchAll(new RegExp(notation.number.source, "g"))) {
    const raw = match[0];
    const before = sentence.slice(Math.max(0, match.index - 12), match.index);
    if (/[\p{L}\d]$/u.test(before) || notation.referenceBefore.test(before)) continue;
    const number = parseNumber(raw, notation);
    if (/^\d{4}$/.test(raw) && number >= 1900 && number <= 2100) {
      if (!years.includes(number)) years.push(number);
      continue;
    }
    value ??= { raw, number };
  }
  return { value, years };
}

function formatMismatch(rule: FactRule, raw: string, known: readonly YearValues[]): string {
  const unit = rule.unit === "value" ? "" : ` ${rule.unit}`;
  const expected = known.map(({ year, values }) => `the ${String(year)} value (${values.map(String).join(", ")}${unit})`).join(" or ");
  return `${rule.description}: ${raw} does not match ${expected}`;
}
