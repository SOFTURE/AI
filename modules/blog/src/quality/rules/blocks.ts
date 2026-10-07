// Block plugin needs (BL-3): a fenced block of a block plugin reads frontmatter keys (`requires`), and
// an article that lacks one would render the block without its data.
import type { BlogArticleInput } from "../../contract.js";
import { parseDirectiveLine, type BlockPlugin, type FoundBlock } from "../../render/render-article.js";
import type { Block } from "../blocks.js";
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

/**
 * Directive lines the renderer would not turn into a block (BL-6 for directives): a name no directive
 * plugin renders (it would show as a paragraph `::chrat{…}`), or attributes it cannot read. Checked
 * only when the app registers a directive plugin; otherwise `::` lines are the app's own business.
 */
export function checkDirectives(blocks: readonly Block[], pluginBlocks: readonly FoundBlock[], plugins: readonly BlockPlugin[]): QualityFinding[] {
  const names = plugins.filter((plugin) => plugin.syntax === "directive").map((plugin) => plugin.type);
  if (names.length === 0) return [];
  const unknown = blocks.flatMap((block) => {
    if (block.kind !== "directive") return [];
    const directive = parseDirectiveLine(block.text);
    if (directive === null || names.includes(directive.name)) return [];
    return [finding(`::${directive.name} is not a directive this blog renders; use one of: ${names.join(", ")}`, block.line)];
  });
  const unreadable = pluginBlocks
    .filter((block) => block.syntax === "directive" && block.attributes === null)
    .map((block) => finding(`the attributes of ::${block.type} cannot be read; write them as key="value" pairs, each key once`, block.line));
  return [...unknown, ...unreadable].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

function finding(message: string, line: number): QualityFinding {
  return { rule: "block-directive", severity: "error", message, line };
}
