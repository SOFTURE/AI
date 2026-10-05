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
      // mistake (`findTermFormConflicts`: the publish run refuses it and `check` reports it), and the
      // link has to be deterministic for rows stored before that check.
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

/** A form that two or more terms claim; `slugs` sorted, the form as the first of them writes it. */
export interface TermFormConflict {
  readonly form: string;
  readonly slugs: readonly string[];
}

/**
 * Forms claimed by more than one term. Two forms collide for the matcher exactly when they are equal
 * after a capital first letter ("ike" and "Ike" do; "IKE" and "Ike" do not), so that is the key. A term
 * that lists one form twice is no conflict. Sorted by form, for stable messages.
 */
export function findTermFormConflicts(terms: readonly GlossaryTerm[]): TermFormConflict[] {
  const claims = new Map<string, Map<string, string>>();
  for (const term of terms) {
    for (const form of term.forms) {
      const trimmed = form.trim();
      if (trimmed === "") continue;
      const key = capitalize(trimmed);
      const bySlug = claims.get(key) ?? new Map<string, string>();
      if (!bySlug.has(term.slug)) bySlug.set(term.slug, trimmed);
      claims.set(key, bySlug);
    }
  }
  return [...claims.values()]
    .filter((bySlug) => bySlug.size > 1)
    .map((bySlug) => {
      const slugs = [...bySlug.keys()].sort();
      // `slugs` holds the keys of the map, so the first one is there.
      return { form: bySlug.get(slugs[0] ?? "") ?? "", slugs };
    })
    .sort((a, b) => a.form.localeCompare(b.form));
}

/** The glossary of a site from its stored rows: every `kind = "term"` row with its forms. */
export function toGlossary(articles: readonly Pick<BlogArticle, "kind" | "slug" | "termForms">[]): GlossaryTerm[] {
  return articles
    .filter((article) => article.kind === "term" && article.termForms.length > 0)
    .map((article) => ({ slug: article.slug, forms: article.termForms }));
}
