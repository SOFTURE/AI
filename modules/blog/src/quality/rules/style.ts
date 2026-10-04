// Style rules (FIRE_TRACKER `src/lib/blog/quality/rules-style.ts`): the ruleset's patterns, the app's
// voice and the YMYL profit promises over prose, then rhythm and formatting measures.
import { getProseBlocks, type Block } from "../blocks.js";
import type { QualityFinding } from "../finding.js";
import type { StylePattern } from "../rulesets/types.js";
import { countWords, splitSentences, toProse } from "../text.js";
import type { RuleInput } from "./input.js";

const PROFIT_PROMISE_MESSAGE = "a promise of profit or an order to buy; not acceptable in a your-money-or-your-life text";

/** The patterns the prose is matched against: ruleset style, app voice, and profit promises when YMYL is on. */
export function getActivePatterns({ settings }: Pick<RuleInput, "settings">): StylePattern[] {
  const patterns = [...settings.ruleset.patterns, ...settings.voicePatterns];
  if (settings.options.ymyl !== null) {
    patterns.push({ id: "profit-promise", severity: "error", pattern: settings.ruleset.profitPromises, message: PROFIT_PROMISE_MESSAGE });
  }
  return patterns;
}

/** Title, description and summary show in search results and above the text: the error patterns apply to them too. */
export function checkMetadataStyle(input: RuleInput): QualityFinding[] {
  const { title, description, summary } = input.article;
  const blocks: Block[] = [title, description, ...(summary === null ? [] : [summary])].map((text) => ({ kind: "paragraph", text, line: 1 }));
  return matchPatterns(blocks, getActivePatterns(input).filter((pattern) => pattern.severity === "error")).map((finding) => ({
    rule: finding.rule,
    severity: finding.severity,
    message: `title, description or summary: ${finding.message}`,
  }));
}

export function checkStyle(input: RuleInput): QualityFinding[] {
  return matchPatterns(getProseBlocks(input.blocks), getActivePatterns(input));
}

/** One error per pattern and block; warnings aggregated to one finding per pattern with a count. */
function matchPatterns(blocks: readonly Block[], patterns: readonly StylePattern[]): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const warningHits = new Map<string, { count: number; line: number; sample: string }>();
  for (const block of blocks) {
    const prose = toProse(block.text);
    for (const style of patterns) {
      const matches = [...prose.matchAll(style.pattern)];
      const first = matches[0]?.[0];
      if (first === undefined) continue;
      if (style.severity === "error") {
        findings.push({ rule: style.id, severity: "error", message: `"${first}": ${style.message}`, line: block.line });
      } else {
        const hit = warningHits.get(style.id) ?? { count: 0, line: block.line, sample: first };
        hit.count += matches.length;
        warningHits.set(style.id, hit);
      }
    }
  }
  for (const style of patterns) {
    const hit = warningHits.get(style.id);
    if (hit !== undefined) {
      findings.push({ rule: style.id, severity: "warning", message: `${String(hit.count)}x (e.g. "${hit.sample}"): ${style.message}`, line: hit.line });
    }
  }
  return findings;
}

const DASH = /\s[—–-]\s|—/g;

/** Rhythm and formatting: dashes (an error over the limit), bold, bold labels, triads, sentence length and variety, openings, headings. */
export function checkRhythm({ blocks, settings }: RuleInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const { limits } = settings.options;
  const prose = getProseBlocks(blocks).filter((block) => block.kind !== "heading" && block.kind !== "table");
  const proseText = prose.map((block) => toProse(block.text));
  const totalWords = proseText.reduce((sum, text) => sum + countWords(text), 0);

  const dashes = proseText.reduce((sum, text) => sum + (text.match(DASH)?.length ?? 0), 0);
  if (dashes >= 3 && dashes > totalWords / limits.wordsPerDash) {
    findings.push({
      rule: "dashes",
      severity: "error",
      message: `${String(dashes)} dashes in ${String(totalWords)} words; at most one per ${String(limits.wordsPerDash)}: use a full stop, a comma or a colon`,
    });
  }
  for (const [index, block] of prose.entries()) {
    if ((proseText[index]?.match(DASH)?.length ?? 0) >= 2) findings.push({ rule: "dashes-paragraph", severity: "warning", message: "two dashes in one paragraph", line: block.line });
  }

  const bold = blocks.reduce((sum, block) => sum + (block.text.match(/\*\*[^*]+\*\*/g)?.length ?? 0), 0);
  if (bold > 0 && bold > totalWords / limits.wordsPerBold) {
    findings.push({ rule: "bold-density", severity: "warning", message: `${String(bold)} bold phrases in ${String(totalWords)} words; bold stops standing out` });
  }
  const boldLabels = blocks.filter((block) => block.kind === "listItem" && /^\*\*[^*]+:\*\*|^\*\*[^*]+\*\*:/.test(block.text));
  const firstLabel = boldLabels[0];
  if (firstLabel !== undefined && boldLabels.length >= 3) {
    findings.push({
      rule: "bold-labels",
      severity: "warning",
      message: `${String(boldLabels.length)} list items start with a bold label; the "**Label:** text" template`,
      line: firstLabel.line,
    });
  }

  const triads = proseText.reduce((sum, text) => sum + (text.match(settings.ruleset.triad)?.length ?? 0), 0);
  if (triads > 3) findings.push({ rule: "triads", severity: "warning", message: `${String(triads)} lists of three; two items sound less like a template than three` });

  const sentences = proseText.flatMap((text) => splitSentences(text));
  const lengths = sentences.map((sentence) => countWords(sentence));
  const long = lengths.filter((length) => length > limits.sentenceWords).length;
  if (long > 0) findings.push({ rule: "long-sentences", severity: "warning", message: `${String(long)} sentences longer than ${String(limits.sentenceWords)} words` });
  if (lengths.length >= 12) {
    const mean = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    const deviation = Math.sqrt(lengths.reduce((sum, length) => sum + (length - mean) ** 2, 0) / lengths.length);
    if (deviation < 4) {
      findings.push({
        rule: "monotone-rhythm",
        severity: "warning",
        message: `the sentences have similar lengths (mean ${mean.toFixed(0)} words, deviation ${deviation.toFixed(1)}); mix short ones with long ones`,
      });
    }
  }
  for (let index = 2; index < sentences.length; index += 1) {
    const openings = sentences.slice(index - 2, index + 1).map((sentence) => sentence.split(" ")[0]?.toLowerCase());
    const opening = openings[0];
    if (opening !== undefined && openings.every((other) => other === opening)) {
      findings.push({ rule: "repeated-openings", severity: "warning", message: `three sentences in a row start with "${opening}"` });
      break;
    }
  }

  if (settings.ruleset.flagsTitleCaseHeadings) {
    for (const block of blocks) {
      if (block.kind !== "heading") continue;
      const words = block.text.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
      if (words.length >= 3 && words.every((word) => /^\p{Lu}/u.test(word))) {
        findings.push({ rule: "title-case-heading", severity: "warning", message: `heading "${block.text}": only the first word starts with a capital letter`, line: block.line });
      }
    }
  }
  return findings;
}
