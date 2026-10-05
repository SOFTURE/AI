// The gate over article files for `softure-blog check` (FIRE_TRACKER `check-file.ts`): parse, rules,
// internal links resolved against the app and its content, external links when a fetch is given, and
// the glossary forms of the whole content folder (a form belongs to one term).
import type { ArticleFile } from "../db/publish-run.js";
import { parseArticleFile, type ParseArticleFileOptions } from "../content/article-file.js";
import { findTermFormConflicts, type GlossaryTerm, type TermFormConflict } from "../render/glossary.js";
import { checkArticleText } from "./check-article.js";
import { checkExternalLinks, type FetchLike } from "./external-links.js";
import { sortFindings, type QualityFinding } from "./finding.js";
import type { InternalLinkResolver } from "./rules/links.js";
import { getEffectiveSeverity, type QualitySettings } from "./settings.js";

export interface CheckArticleFilesOptions {
  readonly settings: QualitySettings;
  readonly today: string;
  readonly resolveInternalLink: InternalLinkResolver;
  readonly parse?: ParseArticleFileOptions;
  /** When given, external links are requested over the network. */
  readonly fetch?: FetchLike;
  /** The site's published terms (`readGlossaryTerms`); a checked term that shares a form with another is reported. */
  readonly glossary?: readonly GlossaryTerm[];
}

export interface FileCheckResult {
  readonly file: string;
  readonly findings: readonly QualityFinding[];
}

export async function checkArticleFiles(files: readonly ArticleFile[], options: CheckArticleFilesOptions): Promise<FileCheckResult[]> {
  const results: FileCheckResult[] = [];
  const conflicts = findTermFormConflicts(options.glossary ?? []);
  for (const file of files) {
    const result = checkArticleText({
      text: file.text,
      fileName: file.name,
      settings: options.settings,
      today: options.today,
      resolveInternalLink: options.resolveInternalLink,
      ...(options.parse === undefined ? {} : { parse: options.parse }),
    });
    const external = options.fetch === undefined ? [] : await checkExternalLinks(result.externalLinks, options.fetch);
    const forms = checkTermForms(file, conflicts, options);
    results.push({ file: file.name, findings: sortFindings([...result.findings, ...external, ...forms]) });
  }
  return results;
}

/** `term-form-conflict` for a published term file whose forms another term claims too. */
function checkTermForms(file: ArticleFile, conflicts: readonly TermFormConflict[], options: CheckArticleFilesOptions): QualityFinding[] {
  if (conflicts.length === 0) return [];
  const parsed = parseArticleFile(file.text, file.name, options.parse);
  if (!parsed.ok || parsed.article.kind !== "term" || parsed.article.status !== "published") return [];
  const { slug } = parsed.article;
  const severity = getEffectiveSeverity(options.settings, "term-form-conflict", "error");
  if (severity === null) return [];
  return conflicts
    .filter((conflict) => conflict.slugs.includes(slug))
    .map((conflict) => ({
      rule: "term-form-conflict",
      severity,
      message: `form "${conflict.form}" is also a form of term ${conflict.slugs.filter((other) => other !== slug).join(", ")}; a form belongs to one term, so remove it from all but one`,
    }));
}
