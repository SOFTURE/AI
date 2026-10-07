// An article or term as Markdown for agents (`Accept: text/markdown`): the stored Markdown in a frame
// that carries what the HTML page shows around it (title, description, the day the facts were checked,
// the summary, sources and FAQ). Exact by construction: no HTML round trip.
import type { BlogArticle } from "../contract.js";
import { en } from "../messages/en.js";
import { replaceArticleBlocks, type BlockPlugin } from "./render-article.js";

export type ArticleMarkdownInput = Pick<BlogArticle, "title" | "description" | "summary" | "bodyMarkdown" | "sources" | "faq" | "currentAsOf" | "fields">;

export interface ArticleMarkdownOptions {
  /** The app's block plugins; a block whose plugin has `markdown` is replaced by its output. */
  readonly blocks?: readonly BlockPlugin[];
  /** The pages' copy for the frame's labels; English by default. */
  readonly messages?: Pick<(typeof en)["pages"], "summary" | "sources" | "faq" | "currentAsOf">;
}

export function toArticleMarkdown(article: ArticleMarkdownInput, options: ArticleMarkdownOptions = {}): string {
  const messages = options.messages ?? en.pages;
  const body = replaceArticleBlocks(article.bodyMarkdown.trim(), options.blocks ?? [], { currentAsOf: article.currentAsOf, fields: article.fields });
  const parts = [`# ${article.title}`, article.description, `${messages.currentAsOf}: ${article.currentAsOf}`];
  if (article.summary !== null) parts.push(`> **${messages.summary}:** ${article.summary}`);
  parts.push(body);
  if (article.sources.length > 0) {
    parts.push(`## ${messages.sources}`, article.sources.map((source) => `- [${escapeLinkText(source.name)}](${source.url})`).join("\n"));
  }
  if (article.faq.length > 0) {
    parts.push(`## ${messages.faq}`, ...article.faq.flatMap((entry) => [`### ${entry.question}`, entry.answer]));
  }
  return `${parts.join("\n\n")}\n`;
}

function escapeLinkText(text: string): string {
  return text.replace(/[[\]\\]/g, (char) => `\\${char}`);
}
