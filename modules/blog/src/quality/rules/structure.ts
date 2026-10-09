// Structure rules (FIRE_TRACKER `src/lib/blog/quality/rules-structure.ts`): metadata lengths and
// freshness, a summary, the answer first, heading order, question sections, length and footnotes.
// Required keys, kinds, slug shape and slug = file name are BL-2's parser's, not repeated here.
import { calendarDaysBetween } from "@softure-ai/core";
import { getProseBlocks, type Block } from "../blocks.js";
import type { QualityFinding } from "../finding.js";
import { countWords, findFootnoteRefs, findSignificantNumbers, toProse } from "../text.js";
import type { RuleInput } from "./input.js";

export function checkMetadata({ article, settings, today }: RuleInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const { limits } = settings.options;
  if (article.title.length > limits.titleChars) {
    findings.push({ rule: "title-length", severity: "warning", message: `the title has ${String(article.title.length)} characters; search engines cut it after about ${String(limits.titleChars)}` });
  }
  const { min, max } = limits.descriptionChars;
  if (article.description.length < min || article.description.length > max) {
    findings.push({ rule: "description-length", severity: "warning", message: `the description has ${String(article.description.length)} characters; aim for ${String(min)}–${String(max)}` });
  }
  if (article.currentAsOf > today) {
    findings.push({ rule: "as-of-future", severity: "error", message: `current_as_of ${article.currentAsOf} is in the future (today is ${today})` });
  } else if (calendarDaysBetween(article.currentAsOf, today) > limits.staleAfterDays) {
    findings.push({ rule: "stale", severity: "warning", message: `current_as_of ${article.currentAsOf} is older than ${String(limits.staleAfterDays)} days; the text waits for fresh numbers` });
  }
  if (article.kind === "article" && article.summary === null) {
    findings.push({ rule: "summary-missing", severity: "error", message: "the article has no summary: a few sentences with the answer for the \"in short\" box" });
  }
  return findings;
}

/** The text opens with a paragraph that answers; an article puts a concrete number in its first two paragraphs. */
export function checkLead({ article, blocks, settings }: RuleInput): QualityFinding[] {
  const first = blocks[0];
  if (first === undefined) return [{ rule: "lead", severity: "error", message: "the text is empty" }];
  if (first.kind !== "paragraph") {
    return [{ rule: "lead", severity: "error", message: "the text starts with a heading or a list; the first block is a paragraph with the answer", line: first.line }];
  }
  const findings: QualityFinding[] = [];
  const limit = settings.options.limits.leadWords[article.kind];
  const words = countWords(toProse(first.text));
  if (words > limit) {
    findings.push({ rule: "lead-length", severity: "warning", message: `the first paragraph has ${String(words)} words; the answer fits in ${String(limit)}`, line: first.line });
  }
  if (article.kind === "article") {
    const opening = blocks.slice(0, 4).filter((block) => block.kind === "paragraph").slice(0, 2);
    const hasNumber = opening.some((block) => findSignificantNumbers(toProse(block.text), settings.ruleset.notation).length > 0);
    if (!hasNumber) {
      findings.push({
        rule: "lead-number",
        severity: "error",
        message: "the first two paragraphs hold no concrete number (an amount or a percentage); the claim with its number goes first",
        line: first.line,
      });
    }
  }
  return findings;
}

/** No H1 (the page title is `title`), no skipped heading level; an article has question sections with short answers. */
export function checkSections({ article, blocks, settings }: RuleInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  let previousLevel = 1;
  for (const block of blocks) {
    if (block.kind !== "heading" || block.level === undefined) continue;
    if (block.level === 1) {
      findings.push({ rule: "heading-h1", severity: "error", message: "a # heading in the body; the page title comes from title, sections start at ##", line: block.line });
    } else if (block.level > previousLevel + 1) {
      findings.push({ rule: "heading-order", severity: "error", message: `heading level ${String(block.level)} follows level ${String(previousLevel)}; do not skip a level`, line: block.line });
    }
    previousLevel = block.level;
  }
  if (article.kind !== "article") return findings;

  const sections = blocks.filter((block) => block.kind === "heading" && block.level === 2);
  if (sections.length < 2) {
    findings.push({ rule: "sections", severity: "error", message: `the article has ${String(sections.length)} ## sections; it needs at least 2` });
  }
  const questions = sections.filter((block) => block.text.trim().endsWith("?"));
  if (questions.length === 0) {
    findings.push({ rule: "section-question", severity: "error", message: "no ## heading is a question; answer sections are what AI assistants quote" });
  }
  const limit = settings.options.limits.answerWords;
  for (const question of questions) {
    const answer = blocks[blocks.indexOf(question) + 1];
    if (answer?.kind !== "paragraph") {
      findings.push({ rule: "section-answer", severity: "error", message: `no paragraph with the answer under "${question.text}"`, line: question.line });
      continue;
    }
    const words = countWords(toProse(answer.text));
    if (words > limit) {
      findings.push({
        rule: "section-answer-length",
        severity: "warning",
        message: `the answer under "${question.text}" has ${String(words)} words; the first sentences answer directly (at most ${String(limit)})`,
        line: answer.line,
      });
    }
  }
  return findings;
}

export function checkLength({ article, blocks, settings }: RuleInput): QualityFinding[] {
  const words = getProseBlocks(blocks).reduce((sum, block) => sum + countWords(toProse(block.text)), 0);
  const { min, max } = settings.options.limits.words[article.kind];
  if (words < min) return [{ rule: "length", severity: "error", message: `the text has ${String(words)} words; ${article.kind === "article" ? "an article" : "a term"} needs at least ${String(min)}` }];
  if (words > max) return [{ rule: "length", severity: "warning", message: `the text has ${String(words)} words; above ${String(max)} readers and assistants lose the answer` }];
  return [];
}

/** Every footnote reference has a definition, and every definition is used. */
export function checkFootnotes({ blocks }: RuleInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const definitions = getFootnoteDefinitions(blocks);
  const used = new Set<string>();
  for (const block of blocks) {
    if (block.kind === "footnote" || block.kind === "directive") continue;
    for (const ref of findFootnoteRefs(block.text)) {
      used.add(ref);
      if (!definitions.has(ref)) findings.push({ rule: "footnote-undefined", severity: "error", message: `footnote [^${ref}] has no definition`, line: block.line });
    }
  }
  for (const [id, block] of definitions) {
    if (!used.has(id)) findings.push({ rule: "footnote-unused", severity: "warning", message: `footnote [^${id}] is not used in the text`, line: block.line });
  }
  return findings;
}

export function getFootnoteDefinitions(blocks: readonly Block[]): Map<string, Block> {
  const definitions = new Map<string, Block>();
  for (const block of blocks) {
    if (block.kind === "footnote" && block.footnoteId !== undefined) definitions.set(block.footnoteId, block);
  }
  return definitions;
}
