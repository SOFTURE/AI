// The gate over article files for `softure-blog check` (FIRE_TRACKER `check-file.ts`): parse, rules,
// internal links resolved against the app and its content, external links when a fetch is given.
import type { ArticleFile } from "../db/publish-run.js";
import type { ParseArticleFileOptions } from "../content/article-file.js";
import { checkArticleText } from "./check-article.js";
import { checkExternalLinks, type FetchLike } from "./external-links.js";
import { sortFindings, type QualityFinding } from "./finding.js";
import type { InternalLinkResolver } from "./rules/links.js";
import type { QualitySettings } from "./settings.js";

export interface CheckArticleFilesOptions {
  readonly settings: QualitySettings;
  readonly today: string;
  readonly resolveInternalLink: InternalLinkResolver;
  readonly parse?: ParseArticleFileOptions;
  /** When given, external links are requested over the network. */
  readonly fetch?: FetchLike;
}

export interface FileCheckResult {
  readonly file: string;
  readonly findings: readonly QualityFinding[];
}

export async function checkArticleFiles(files: readonly ArticleFile[], options: CheckArticleFilesOptions): Promise<FileCheckResult[]> {
  const results: FileCheckResult[] = [];
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
    results.push({ file: file.name, findings: sortFindings([...result.findings, ...external]) });
  }
  return results;
}
