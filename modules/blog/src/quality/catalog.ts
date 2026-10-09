// The rule catalog: every rule the gate can report for an app's settings, with its effective
// severity. The writing skill (BL-7) is checked against it, so a rule the gate enforces is named in
// the skill and the skill names no rule the gate lacks.
import type { QualitySeverity } from "./finding.js";
import type { QualityRuleInfo } from "./plugin.js";
import { getEffectiveSeverity, type QualitySettings } from "./settings.js";

export const QUALITY_RULE_GROUPS = ["file", "structure", "links", "images", "ymyl", "style", "voice", "facts", "plugin"] as const;
export type QualityRuleGroup = (typeof QUALITY_RULE_GROUPS)[number];

export interface QualityCatalogRule extends QualityRuleInfo {
  readonly group: QualityRuleGroup;
}

const rule = (group: QualityRuleGroup, id: string, severity: QualitySeverity, description: string): QualityCatalogRule => ({ group, id, severity, description });

/** Rules that do not depend on the ruleset, the voice or plugins. */
const CORE_RULES: readonly QualityCatalogRule[] = [
  rule("file", "file", "error", "the file parses: frontmatter keys and values, slug equal to the file name"),
  rule("structure", "title-length", "warning", "the title fits in search results (limits.titleChars)"),
  rule("structure", "description-length", "warning", "the description is between limits.descriptionChars.min and max characters"),
  rule("structure", "as-of-future", "error", "current_as_of is not in the future"),
  rule("structure", "stale", "warning", "current_as_of is not older than limits.staleAfterDays"),
  rule("structure", "summary-missing", "error", "an article has a summary"),
  rule("structure", "lead", "error", "the text opens with a paragraph that answers"),
  rule("structure", "lead-length", "warning", "the first paragraph fits in limits.leadWords"),
  rule("structure", "lead-number", "error", "an article has a concrete number in its first two paragraphs"),
  rule("structure", "heading-h1", "error", "no # heading in the body"),
  rule("structure", "heading-order", "error", "headings do not skip a level"),
  rule("structure", "sections", "error", "an article has at least two ## sections"),
  rule("structure", "section-question", "error", "at least one ## heading of an article is a question"),
  rule("structure", "section-answer", "error", "a question heading is followed by a paragraph"),
  rule("structure", "section-answer-length", "warning", "the answer under a question fits in limits.answerWords"),
  rule("structure", "length", "error", "the word count is within limits.words (a warning above the maximum)"),
  rule("structure", "footnote-undefined", "error", "every footnote reference has a definition"),
  rule("structure", "footnote-unused", "warning", "every footnote definition is referenced"),
  rule("links", "internal-links", "error", "at least limits.internalLinks internal links (a warning for a term)"),
  rule("links", "internal-link-target", "error", "every internal link leads to a page, article or glossary term"),
  rule("links", "external-link-https", "warning", "external links use https"),
  rule("links", "external-link-dead", "error", "external links answer 2xx (only with --external)"),
  rule("links", "term-form-conflict", "error", "a glossary form belongs to one published term (only in check; publish refuses it always)"),
  rule("images", "image-source", "error", "an image comes from the site or a host of blog({ images: { hosts } })"),
  rule("images", "image-alt", "error", "an image has alt text"),
  rule("images", "image-dimensions", "error", "the app knows an image's width and height (blog({ images: { dimensions } }))"),
  rule("style", "dashes", "error", "at most one dash per limits.wordsPerDash words"),
  rule("style", "dashes-paragraph", "warning", "at most one dash per paragraph"),
  rule("style", "bold-density", "warning", "at most one bold phrase per limits.wordsPerBold words"),
  rule("style", "bold-labels", "warning", "fewer than three list items start with a bold label"),
  rule("style", "triads", "warning", "at most three lists of three"),
  rule("style", "long-sentences", "warning", "sentences fit in limits.sentenceWords"),
  rule("style", "monotone-rhythm", "warning", "sentence lengths vary"),
  rule("style", "repeated-openings", "warning", "no three sentences in a row start with the same word"),
];

const YMYL_RULES: readonly QualityCatalogRule[] = [
  rule("ymyl", "sources-missing", "error", "an article lists its sources"),
  rule("ymyl", "source-https", "error", "every source address uses https"),
  rule("ymyl", "number-source", "error", "every significant number (amount, percentage, 1000 or more) carries a footnote"),
  rule("ymyl", "footnote-source", "error", "every footnote has a source address or the app's own calculation mark"),
  rule("ymyl", "footnote-not-in-sources", "error", "every address in a footnote is a listed source"),
  rule("ymyl", "profit-promise", "error", "no promise of profit and no order to buy"),
];

const PLUGIN_RULES: readonly QualityCatalogRule[] = [
  rule("plugin", "plugin-failed", "error", "a rule plugin ran without throwing"),
  rule("plugin", "plugin-rule-undeclared", "error", "a rule plugin reports only the rules it declares"),
];

/** Every rule the gate can report with these settings, with the effective severity; rules switched off are left out. */
export function listQualityRules(settings: QualitySettings): QualityCatalogRule[] {
  const { ruleset, options } = settings;
  const rules: QualityCatalogRule[] = [
    ...CORE_RULES,
    ...(ruleset.flagsTitleCaseHeadings ? [rule("style", "title-case-heading", "warning", "headings use sentence case")] : []),
    ...ruleset.patterns.map((pattern) => rule("style", pattern.id, pattern.severity, pattern.message)),
    ...settings.voicePatterns.map((pattern) => rule("voice", pattern.id, pattern.severity, pattern.message)),
    ...(options.ymyl === null ? [] : YMYL_RULES),
    ...(options.blocks.length === 0 ? [] : [rule("structure", "block-requires", "error", "a block plugin's block has the frontmatter keys it requires")]),
    ...(options.blocks.some((plugin) => plugin.syntax === "directive")
      ? [rule("structure", "block-directive", "error", "a ::directive line names a directive the blog renders, with readable key=\"value\" attributes")]
      : []),
    ...(options.blocks.some((plugin) => plugin.numbers !== undefined)
      ? [rule("structure", "block-numbers", "error", "every significant number of the paragraph before and after a data block is one of the block's numbers")]
      : []),
    ...options.facts.map((fact) => rule("facts", fact.id, fact.severity, fact.description)),
    ...(options.plugins.length === 0 ? [] : PLUGIN_RULES),
    ...options.plugins.flatMap((plugin) => plugin.rules.map((info) => rule("plugin", info.id, info.severity, info.description))),
  ];
  return rules.flatMap((entry) => {
    const severity = getEffectiveSeverity(settings, entry.id, entry.severity);
    return severity === null ? [] : [{ ...entry, severity }];
  });
}
