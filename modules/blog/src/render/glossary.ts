// Matching glossary term forms in plain text: no Markdown and no database. The renderer
// (`render-article.ts`) calls the matcher on the text of paragraphs, lists and tables.
//
// - A form is a phrase from the term's file (`forms`), not a word cut out of an inflection: an editor
//   picks "bridge to retirement", not "bridge", so a plain sentence about a bridge gets no link.
// - Word bounds are Unicode-aware. `\b` in JS knows only ASCII, so "IKE" would hit "IKEA" without
//   lookarounds on `\p{L}`.
// - Case as written in the form, plus a variant with a capital first letter (start of a sentence).
//   "IKE" does not hit "ike": an acronym in lower case is another word or a typo.
// - The longest form wins at the same position: "IKZE relief" before "IKZE" when both are terms.
import type { BlogArticle } from "../contract.js";

export interface GlossaryTerm {
  readonly slug: string;
  readonly forms: readonly string[];
}

export interface TermMatch {
  readonly index: number;
  readonly text: string;
  readonly slug: string;
}

/** Every occurrence of a form in the text, left to right, without overlaps. */
export type TermMatcher = (text: string) => TermMatch[];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function createTermMatcher(terms: readonly GlossaryTerm[]): TermMatcher {
  const slugByForm = new Map<string, string>();
  for (const term of terms) {
    for (const form of term.forms) {
      const trimmed = form.trim();
      if (trimmed === "") continue;
      // The first term with a given form wins: two terms with the same phrase are an editorial
      // mistake (the quality gate reports it), and the link has to be deterministic.
      for (const variant of [trimmed, capitalize(trimmed)]) {
        if (!slugByForm.has(variant)) slugByForm.set(variant, term.slug);
      }
    }
  }
  if (slugByForm.size === 0) return () => [];
  const alternatives = [...slugByForm.keys()]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "gu");

  return (text) =>
    [...text.matchAll(pattern)].map((match) => ({
      index: match.index,
      text: match[0],
      // Every alternative of the pattern is a key of the map.
      slug: slugByForm.get(match[0]) ?? "",
    }));
}

/** The glossary of a site from its stored rows: every `kind = "term"` row with its forms. */
export function toGlossary(articles: readonly Pick<BlogArticle, "kind" | "slug" | "termForms">[]): GlossaryTerm[] {
  return articles
    .filter((article) => article.kind === "term" && article.termForms.length > 0)
    .map((article) => ({ slug: article.slug, forms: article.termForms }));
}
