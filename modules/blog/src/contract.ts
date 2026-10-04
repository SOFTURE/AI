// Types and codes of the blog's content contract: what a file holds, what a row holds, what the
// store answers. No user-facing copy here: labels come from `messages`.

export const BLOG_ARTICLE_KINDS = ["article", "term"] as const;
/** `article`: a text in the blog; `term`: a glossary definition that articles link to. */
export type BlogArticleKind = (typeof BLOG_ARTICLE_KINDS)[number];

export const BLOG_ARTICLE_STATUSES = ["draft", "published", "withdrawn"] as const;
/** `withdrawn` keeps the row: its address answers 410 Gone, not 404. */
export type BlogArticleStatus = (typeof BLOG_ARTICLE_STATUSES)[number];

export interface BlogSource {
  readonly name: string;
  readonly url: string;
}

export interface BlogFaqEntry {
  readonly question: string;
  readonly answer: string;
}

/** The app's own frontmatter fields (`blog({ fields })`), as its schema parsed them. */
export type BlogFields = Readonly<Record<string, unknown>>;

/** The content a reader sees; the content hash covers exactly these fields. */
export interface BlogArticleContent {
  readonly kind: BlogArticleKind;
  readonly cluster: string | null;
  readonly title: string;
  readonly description: string;
  /** The "in short" box above the body; `null` for none. */
  readonly summary: string | null;
  readonly bodyMarkdown: string;
  /** `YYYY-MM-DD`: the day the facts were checked. */
  readonly currentAsOf: string;
  readonly sources: readonly BlogSource[];
  readonly faq: readonly BlogFaqEntry[];
  /** Phrases that link to a term's definition; empty for an article. */
  readonly termForms: readonly string[];
  readonly fields: BlogFields;
}

/** An article as a file gives it: what `publishArticle` stores. */
export interface BlogArticleInput extends BlogArticleContent {
  readonly id: string;
  readonly slug: string;
  readonly status: BlogArticleStatus;
  /** From the file; `null`: the moment it is first published. */
  readonly publishedAt: Date | null;
  /** The main text of its cluster; outside the content hash (it changes other pages, not this one). */
  readonly isPillar: boolean;
  readonly contentSha256: string;
}

/** A stored article. */
export interface BlogArticle extends BlogArticleInput {
  /** Set when the content of an already published text changes. */
  readonly updatedAt: Date | null;
  readonly createdAt: Date;
}

/** A row before or after a publish. */
export interface BlogArticleState {
  readonly slug: string;
  readonly status: BlogArticleStatus;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date | null;
  readonly contentSha256: string;
}

export type BlogPublishAction = "added" | "changed" | "unchanged";

/**
 * `blog.slug_taken`: another article has the slug now. `blog.slug_in_history`: another article had
 * it before and the old address redirects there (a 301 would have two targets).
 */
export type BlogSlugErrorCode = "blog.slug_taken" | "blog.slug_in_history";

export type BlogPublishResult =
  | {
      readonly ok: true;
      readonly action: BlogPublishAction;
      readonly before: BlogArticleState | null;
      readonly after: BlogArticleState;
      /** The slug that has just entered the slug history. */
      readonly previousSlug: string | null;
    }
  | { readonly ok: false; readonly error: BlogSlugErrorCode; readonly otherArticleId: string };
