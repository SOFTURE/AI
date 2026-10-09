// The gate over one article (FIRE_TRACKER `src/lib/blog/quality/check-article.ts`): one entry for
// `softure-blog check`, the publish gate and the tests. Pure: the parsed article, today and the link
// resolver come in; the network check of external links is separate.
import type { BlogArticleInput } from "../contract.js";
import { findArticleImages } from "../render/images.js";
import { findArticleBlocks, type FoundBlock } from "../render/render-article.js";
import { parseArticleFile, type ParseArticleFileOptions } from "../content/article-file.js";
import { splitArticleBody, splitBlocks } from "./blocks.js";
import { sortFindings, type QualityFinding } from "./finding.js";
import type { QualityPlugin } from "./plugin.js";
import { checkBlockNumbers, checkBlockRequires, checkDirectives } from "./rules/blocks.js";
import { checkFacts } from "./rules/facts.js";
import { checkImages } from "./rules/images.js";
import type { RuleInput } from "./rules/input.js";
import { checkLinks, collectLinks, type InternalLinkResolver } from "./rules/links.js";
import { checkFootnotes, checkLead, checkLength, checkMetadata, checkSections } from "./rules/structure.js";
import { checkMetadataStyle, checkRhythm, checkStyle } from "./rules/style.js";
import { checkNumberSources, checkSources } from "./rules/ymyl.js";
import { getEffectiveSeverity, type QualitySettings } from "./settings.js";

export interface QualityCheckResult {
  readonly findings: readonly QualityFinding[];
  /** External addresses for the network check (`--external`). */
  readonly externalLinks: readonly { readonly url: string; readonly line: number }[];
}

export interface CheckArticleInput {
  /** The parsed file. */
  readonly article: BlogArticleInput;
  /** The whole file text, for the body's line numbers. */
  readonly text: string;
  readonly settings: QualitySettings;
  /** `YYYY-MM-DD` in the app's time zone. */
  readonly today: string;
  /** Default: every internal link exists (the publish gate; `check` resolves them). */
  readonly resolveInternalLink?: InternalLinkResolver;
}

export function checkArticle(input: CheckArticleInput): QualityCheckResult {
  const { article, settings, today } = input;
  const split = splitArticleBody(input.text);
  const blocks = split === null ? splitBlocks(article.bodyMarkdown) : splitBlocks(split.body, split.bodyStartLine);
  const body = split?.body ?? article.bodyMarkdown;
  const bodyStartLine = split?.bodyStartLine ?? 1;
  const pluginBlocks = findPluginBlocks(body, bodyStartLine, settings);
  const images = findArticleImages(body).map((image) => ({ ...image, line: image.line + bodyStartLine - 1 }));
  const ruleInput: RuleInput = { article, blocks, settings, today };
  const links = collectLinks(ruleInput);

  const builtIn = [
    ...checkMetadata(ruleInput),
    ...checkMetadataStyle(ruleInput),
    ...checkLead(ruleInput),
    ...checkSections(ruleInput),
    ...checkLength(ruleInput),
    ...checkFootnotes(ruleInput),
    ...(settings.options.ymyl === null ? [] : [...checkSources(ruleInput), ...checkNumberSources(ruleInput)]),
    ...checkLinks(ruleInput, links, input.resolveInternalLink ?? (() => true)),
    ...checkStyle(ruleInput),
    ...checkRhythm(ruleInput),
    ...checkBlockRequires(article, pluginBlocks),
    ...checkDirectives(blocks, pluginBlocks, settings.options.blocks),
    ...checkBlockNumbers({ article, blocks, pluginBlocks, plugins: settings.options.blocks, ruleset: settings.ruleset }),
    ...checkFacts(ruleInput),
    ...checkImages(images, settings.images),
  ];
  const fromPlugins = settings.options.plugins.flatMap((plugin) => runPlugin(plugin, { article, blocks, pluginBlocks, today, ruleset: settings.ruleset }));
  return { findings: applySeverity(settings, [...builtIn, ...fromPlugins]), externalLinks: links.external };
}

export interface CheckArticleTextInput extends Omit<CheckArticleInput, "article"> {
  /** A path or a bare name; it must read `<slug>.md`. */
  readonly fileName: string;
  /** The app's `fields` and reserved slugs, as the publish run applies them. */
  readonly parse?: ParseArticleFileOptions;
}

/** Parses the file first; parse errors are `file` findings and stop the check. */
export function checkArticleText(input: CheckArticleTextInput): QualityCheckResult {
  const parsed = parseArticleFile(input.text, input.fileName, input.parse);
  if (!parsed.ok) {
    return { findings: applySeverity(input.settings, parsed.errors.map((message) => ({ rule: "file", severity: "error", message }))), externalLinks: [] };
  }
  return checkArticle({ ...input, article: parsed.article });
}

/** The app's plugin blocks with file lines; none without `quality.blocks`. */
function findPluginBlocks(body: string, bodyStartLine: number, settings: QualitySettings): FoundBlock[] {
  if (settings.options.blocks.length === 0) return [];
  return findArticleBlocks(body, settings.options.blocks).map((block) => ({ ...block, line: block.line + bodyStartLine - 1, endLine: block.endLine + bodyStartLine - 1 }));
}

function runPlugin(plugin: QualityPlugin, context: Parameters<QualityPlugin["check"]>[0]): QualityFinding[] {
  let findings: readonly QualityFinding[];
  try {
    findings = plugin.check(context);
  } catch (error) {
    // A plugin bug must not crash a publish with a stack trace; it refuses the file instead.
    return [{ rule: "plugin-failed", severity: "error", message: `plugin ${plugin.name} failed: ${error instanceof Error ? error.message : String(error)}` }];
  }
  const declared = new Set(plugin.rules.map((info) => info.id));
  return findings.map((finding) =>
    declared.has(finding.rule)
      ? finding
      : { rule: "plugin-rule-undeclared", severity: "error", message: `plugin ${plugin.name} reported rule ${finding.rule}, which it does not declare`, ...(finding.line === undefined ? {} : { line: finding.line }) },
  );
}

function applySeverity(settings: QualitySettings, findings: readonly QualityFinding[]): QualityFinding[] {
  return sortFindings(
    findings.flatMap((finding) => {
      const severity = getEffectiveSeverity(settings, finding.rule, finding.severity);
      return severity === null ? [] : [{ ...finding, severity }];
    }),
  );
}
