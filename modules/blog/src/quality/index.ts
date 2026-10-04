// The quality gate's public surface, re-exported from `@softure-ai/blog/server`.
export { listQualityRules, QUALITY_RULE_GROUPS, type QualityCatalogRule, type QualityRuleGroup } from "./catalog.js";
export { checkArticle, checkArticleText, type CheckArticleInput, type CheckArticleTextInput, type QualityCheckResult } from "./check-article.js";
export { checkArticleFiles, type CheckArticleFilesOptions, type FileCheckResult } from "./check-files.js";
export { getProseBlocks, splitArticleBody, splitBlocks, type Block, type BlockKind } from "./blocks.js";
export { checkExternalLinks, checkExternalUrl, type FetchLike } from "./external-links.js";
export { formatFinding, hasQualityErrors, QUALITY_SEVERITIES, sortFindings, type QualityFinding, type QualitySeverity } from "./finding.js";
export { createQualityGate } from "./gate.js";
export { collectAppRoutes, createInternalLinkResolver, findAppDir, readContentFolder, readPublishedContent, type AppRoute, type InternalLinkResolverOptions } from "./link-targets.js";
export { qualityOptionsSchema, type QualityLimits, type QualityOptions, type QualityOptionsInput } from "./options.js";
export { isQualityPlugin, type QualityPlugin, type QualityPluginContext, type QualityRuleInfo } from "./plugin.js";
export { collectLinks, type InternalLinkResolver, type LinkSummary } from "./rules/links.js";
export { enRuleset, plRuleset, QUALITY_LANGUAGES, QUALITY_RULESETS, type LanguageRuleset, type QualityLanguage, type StylePattern } from "./rulesets/index.js";
export { getLocalDate, resolveQualitySettings, type QualitySettings } from "./settings.js";
export {
  countWords,
  findBareUrls,
  findFootnoteRefs,
  findLinks,
  findSignificantNumbers,
  normalizeNumber,
  parseNumber,
  splitSentences,
  toProse,
  wordPattern,
  type MarkdownLink,
  type NumberNotation,
} from "./text.js";
