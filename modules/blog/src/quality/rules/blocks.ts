// Block plugin needs (BL-3): a fenced block of a block plugin reads frontmatter keys (`requires`), and
// an article that lacks one would render the block without its data.
import type { BlogArticleInput } from "../../contract.js";
import type { FoundBlock } from "../../render/render-article.js";
import type { QualityFinding } from "../finding.js";

export function checkBlockRequires(article: BlogArticleInput, pluginBlocks: readonly FoundBlock[]): QualityFinding[] {
  return pluginBlocks.flatMap((block) =>
    block.requires
      .filter((key) => !hasFrontmatterKey(article, key))
      .map((key) => ({ rule: "block-requires", severity: "error" as const, message: `the ${block.type} block needs ${key} in the frontmatter`, line: block.line })),
  );
}

/** Whether the file set a frontmatter key: a module key with a value, or a key of the app's fields. */
function hasFrontmatterKey(article: BlogArticleInput, key: string): boolean {
  switch (key) {
    case "id":
    case "slug":
    case "kind":
    case "title":
    case "description":
    case "status":
    case "current_as_of":
      return true;
    case "cluster":
      return article.cluster !== null;
    case "pillar":
      return article.isPillar;
    case "summary":
      return article.summary !== null;
    case "published_at":
      return article.publishedAt !== null;
    case "sources":
      return article.sources.length > 0;
    case "faq":
      return article.faq.length > 0;
    case "forms":
      return article.termForms.length > 0;
    default:
      return article.fields[key] !== undefined;
  }
}
